import axios from 'axios'
import * as cheerio from 'cheerio'
import { isNumber, compact, isEmpty, range } from 'lodash'
import nodeUrl from 'url'

export interface MetaData {
  title?: string
  description?: string
  imageUrl?: string
  blobUrl?: string
  encryptedImageUrl?: string
}

const allowedDomains: string[] = [
  'messenger.com',
  'www.messenger.com',
  'google.com',
  'www.google.com',
]

const MAX_REDIRECTS: number = 3
// See <https://tools.ietf.org/html/rfc3986>.
const VALID_URI_CHARACTERS = new Set([
  '%',
  // "gen-delims"
  ':',
  '/',
  '?',
  '#',
  '[',
  ']',
  '@',
  // "sub-delims"
  '!',
  '$',
  '&',
  "'",
  '(',
  ')',
  '*',
  '+',
  ',',
  ';',
  '=',
  // unreserved
  ...String.fromCharCode(...range(65, 91), ...range(97, 123)),
  ...range(10).map(String),
  '-',
  '.',
  '_',
  '~',
])
const ASCII_PATTERN = /[\u0020-\u007F]/g
const MAX_HREF_LENGTH = 2 ** 12

function checkParseUrl (value: string): undefined | URL {
  if (typeof value === 'string') {
    try {
      return new URL(value)
    } catch (err) {
      /* Errors are ignored. */
    }
  }

  return undefined
}

function isAllowedDomain(url: string): boolean {
  return true
  // const { hostname } = new URL(url)
  // return allowedDomains.includes(hostname)
}

function sanitizeUrl(url: string): string {
  const { protocol, hostname, pathname } = new URL(url)
  return `${protocol}//${hostname}${pathname}`
}

function isLinkSus(href: string): boolean {
  // Avoid extremely long urls
  if (href.length > MAX_HREF_LENGTH) {
    return true
  }

  const url = checkParseUrl(href)

  // Invalid links
  if (!url) {
    return true
  }

  // Links with non-https protocols are not allowed
  const { protocol } = url
  if (protocol !== 'https:') {
    return true
  }

  // Links with credentials are not allowed
  if (url.username || url.password) {
    return true
  }

  // Links with no hostname are not allowed
  if (!url.hostname) {
    return true
  }

  if (url.hostname.length > 2048) {
    return true
  }

  // Encoded characters in the hostname are not allowed
  if (url.hostname.includes('%')) {
    return true
  }

  // There must be at least 2 domain labels, and none of them can be empty.
  const labels = url.hostname.split('.')
  if (labels.length < 2 || labels.some(isEmpty)) {
    return true
  }

  // This is necessary because getDomain returns domains in punycode form.
  const unicodeDomain = nodeUrl.domainToUnicode
    ? nodeUrl.domainToUnicode(url.hostname)
    : url.hostname

  const withoutPeriods = unicodeDomain.replace(/\./g, '')

  const hasASCII = ASCII_PATTERN.test(withoutPeriods)
  const withoutASCII = withoutPeriods.replace(ASCII_PATTERN, '')

  const isMixed = hasASCII && withoutASCII.length > 0
  if (isMixed) {
    return true
  }

  const startOfPathAndHash = href.indexOf('/', url.protocol.length + 4)
  const pathAndHash =
    startOfPathAndHash === -1 ? '' : href.substr(startOfPathAndHash)
  return [...pathAndHash].some(
    (character) => !VALID_URI_CHARACTERS.has(character)
  )
}

function extractMetaData(html: string, url: string): MetaData {
  const $ = cheerio.load(html)

  // Look for Twitter card tags and Facebook Open Graph tags
  const title =
    $('meta[property="og:title"]').attr('content') ||
    $('meta[name="twitter:title"]').attr('content') ||
    $('title').text()
  const description =
    $('meta[property="og:description"]').attr('content') ||
    $('meta[name="twitter:description"]').attr('content') ||
    $('meta[name="description"]').attr('content')
  let imageUrl =
    $('meta[property="og:image"]').attr('content') ||
    $('meta[name="twitter:image"]').attr('content')

  // Check whether the image URL is relative or absolute, and add the domain name if necessary
  if (imageUrl && !/^https?:\/\//i.test(imageUrl)) {
    const { protocol, hostname } = new URL(url)
    imageUrl = `${protocol}//${hostname}${imageUrl}`
  }
  return { title, description, imageUrl }
}

async function getMetaData(url: string): Promise<MetaData | null> {
  if (isLinkSus(url) || !isAllowedDomain(url)) {
    console.error('Invalid URL or domain not allowed')
    return null
  }

  try {
    const sanitizedUrl = sanitizeUrl(url)
    const response = await axios({
      url: sanitizedUrl,
      maxRedirects: MAX_REDIRECTS,
    })
    const metaData = extractMetaData(response.data, sanitizedUrl)
    return metaData
  } catch (error) {
    console.error('Error fetching URL')
    return null
  }
}

export { getMetaData, isLinkSus }
