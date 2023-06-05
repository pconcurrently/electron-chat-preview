import axios from 'axios'
import * as crypto from 'crypto'
import * as fs from 'fs'
import * as https from 'https'
import { PassThrough, Readable, Transform, pipeline } from 'stream'
import { promisify } from 'util'
import { mkdirp } from 'mkdirp'
import { isLinkSus } from './urlScrape'

const DEFAULT_SECRET_KEY_FILE_PATH =
  '~/code4po/electron-react-boilerplate/secret.key'
const USER_AGENT = 'WhatsApp/2.21.5.17 i' // Use Whatsapp user agent to bypass anti-bot protection
const MAX_IMAGE_SIZE = 2 * 1024 * 1024 // 2 MB

const pipelineAsync = promisify(pipeline)

async function getSecretKey(filePath?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const path = filePath || DEFAULT_SECRET_KEY_FILE_PATH
    fs.readFile(path, 'utf8', (error, data) => {
      if (error) {
        if (error.code === 'ENOENT') {
          // File does not exist, create a new secret key and save it to the file
          console.log('Creating a new secret key')
          const secretKey = crypto.randomBytes(32).toString('hex')
          mkdirp(path)
          fs.writeFile(path, secretKey, 'utf8', (writeError) => {
            if (writeError) {
              reject(writeError)
            } else {
              resolve(secretKey)
            }
          })
        } else {
          // Some other error occurred
          reject(error)
        }
      } else {
        // File exists, return the secret key
        resolve(data)
      }
    })
  })
}

async function downloadImage(url: string): Promise<Buffer | null> {
  if (!isLinkSus(url)) {
    const headRes = await axios.head(url, {
      headers: {
        'User-Agent': USER_AGENT,
      },
    })

    const contentLength = headRes.headers['content-length']
    if (contentLength > MAX_IMAGE_SIZE) {
      throw new Error(
        `The image size exceeds the maximum allowed size.`
      )
    }

    const contentType = headRes.headers['content-type']
    if (!contentType.startsWith('image/')) {
      throw new Error(
        `Failed to download image. The URL does not point to an image file: ${url}`
      )
    }

    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': USER_AGENT,
      },
    })

    const imageBuffer = Buffer.from(response.data, 'binary')
    return imageBuffer
  }
  return null
}

async function encryptImageFromBlob(
  blobUrl: string,
  secretKey: string
): Promise<void> {
  const response = await axios.get(blobUrl, { responseType: 'arraybuffer' })
  const buffer = Buffer.from(response.data, 'binary')

  const iv = crypto.randomBytes(16) // Generate a random initialization vector
  const cipher = crypto.createCipheriv(
    'aes-256-cbc',
    Buffer.from(secretKey),
    iv
  )
  const input = new PassThrough()
  const output = fs.createWriteStream('encrypted.txt')
  input.end(buffer)

  await pipelineAsync(input, cipher, output)

  console.log('Image has been encrypted and saved to encrypted.txt')
}

async function encryptImage(
  imageUrl: string,
  secretKey: string,
  outputFilePath: string
): Promise<void> {
  const algorithm = 'aes-256-cbc'
  const key = crypto.scryptSync(secretKey, 'salt', 32)
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv(algorithm, key, iv)

  const transformStream = new Transform({
    transform(chunk, encoding, callback) {
      this.push(cipher.update(chunk))
      callback()
    },
    flush(callback) {
      this.push(cipher.final())
      callback()
    },
  })
  const outputStream = fs.createWriteStream(outputFilePath)

  outputStream.write(iv.toString('hex'))

  return new Promise((resolve, reject) => {
    https.get(imageUrl, (response) => {
      response
        .pipe(transformStream)
        .pipe(outputStream)
        .on('finish', () => {
          resolve()
        })
        .on('error', (error) => {
          reject(error)
        })
    })
  })
}

async function decryptImage(
  encryptedImageUrl: string,
  secretKey: string,
  outputFilePath: string
): Promise<void> {
  const algorithm = 'aes-256-cbc'
  const key = crypto.scryptSync(secretKey, 'salt', 32)

  const ivSize = 32 // 16 bytes, hex-encoded

  const outputStream = fs.createWriteStream(outputFilePath)
  let iv: Buffer

  const transformStream = new Transform({
    transform(chunk, encoding, callback) {
      if (!iv) {
        iv = Buffer.from(chunk.slice(0, ivSize), 'hex')
        const decipher = crypto.createDecipheriv(algorithm, key, iv)
        this.push(decipher.update(chunk.slice(ivSize)))
      } else {
        this.push(crypto.createDecipheriv(algorithm, key, iv).update(chunk))
      }
      callback()
    },
  })

  return new Promise((resolve, reject) => {
    https.get(encryptedImageUrl, (response) => {
      response
        .pipe(transformStream)
        .pipe(outputStream)
        .on('finish', () => {
          resolve()
        })
        .on('error', (error) => {
          reject(error)
        })
    })
  })
}

async function decryptImageToBlob(
  encryptedImageUrl: string,
  secretKey: string
): Promise<string> {
  const algorithm = 'aes-256-cbc'
  const key = crypto.scryptSync(secretKey, 'salt', 32)

  const ivSize = 32 // 16 bytes, hex-encoded
  let iv: Buffer

  const chunks: Uint8Array[] = []

  const transformStream = new Transform({
    transform(chunk, encoding, callback) {
      if (!iv) {
        iv = Buffer.from(chunk.slice(0, ivSize), 'hex')
        this.push(
          crypto
            .createDecipheriv(algorithm, key, iv)
            .update(chunk.slice(ivSize))
        )
      } else {
        this.push(crypto.createDecipheriv(algorithm, key, iv).update(chunk))
      }
      callback()
    },
  })

  return new Promise((resolve, reject) => {
    https.get(encryptedImageUrl, (response) => {
      const readable = new Readable().wrap(response)
      readable
        .pipe(transformStream)
        .on('data', (chunk) => {
          chunks.push(new Uint8Array(chunk))
        })
        .on('end', () => {
          const blob = new Blob(chunks, { type: 'image/jpeg' }) // Set MIME type to your image type
          const blobUrl = URL.createObjectURL(blob)
          resolve(blobUrl)
        })
        .on('error', (error) => {
          reject(error)
        })
    })
  })
}

async function cleanupDecryptedFile(outputFilePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    fs.unlink(outputFilePath, (error) => {
      if (error) {
        reject(error)
      } else {
        resolve()
      }
    })
  })
}

export {
  encryptImage,
  encryptImageFromBlob,
  decryptImage,
  decryptImageToBlob,
  cleanupDecryptedFile,
  getSecretKey,
  downloadImage,
}
