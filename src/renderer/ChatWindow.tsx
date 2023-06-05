import React from 'react'
import { ChatRecord } from './ChatRecord'
import { UrlPreview } from './UrlPreview'
import { MetaData } from '../main/urlScrape'
import axios from 'axios'

const MAX_IMAGE_SIZE = 2 * 1024 * 1024 // 2 MB

export type ChatMessageType = {
  messageId: string
  message: string
  sender: string
}

const ChatWindow = () => {
  const [inputMessage, setInputMessage] = React.useState<string>('')
  const [messages, setMessages] = React.useState<ChatMessageType[]>([])
  const [metaData, setMetaData] = React.useState<MetaData | null>(null)

  const inputChangeHandler = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputMessage(e.target.value)
  }

  const chatSubmitHandler = async () => {
    const newMessage: ChatMessageType = {
      messageId: Math.random().toString(36).substr(2, 9),
      message: inputMessage,
      sender: 'Me',
    }
    if (metaData?.encryptedImageUrl) {
      const encryptedLocalPath = await window.electron.encryptImage(metaData?.encryptedImageUrl)
      // Upload to CDN, get url
    }
    setMessages([...messages, newMessage])
    setInputMessage('')
    if (metaData) {
      setMetaData(null)
    }
  }

  const inputKeyDownHandler = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      chatSubmitHandler()
    } else {
      setMetaData(null)
    }
  }

  const inputPasteHandler = async (e: React.ClipboardEvent<HTMLDivElement>) => {
    const text = e.clipboardData?.getData('text/plain')
    if (text) {
      const metaData = await window.electron.urlScrape(text)

      if (metaData) {
        const { imageUrl } = metaData
        let blobUrl
        if (imageUrl) {
          const base64Image = await window.electron.downloadImage(imageUrl)
          const blob = await fetch(
            `data:image/jpeg;base64,${base64Image}`
          ).then((res) => res.blob()) // TODO: should save as local file
          blobUrl = URL.createObjectURL(blob)
        }
        setMetaData({ ...metaData, blobUrl })
      } else {
        setMetaData(null)
      }
    }
  }

  function onClose() {
    setMetaData(null)
  }

  return (
    <div className="dark-theme" id="chat">
      <div className="chat__conversation-board">
        {messages.map((message, index) => (
          <ChatRecord key={index} record={message} />
        ))}
      </div>
      <div className="chat__conversation-panel">
        {metaData && <UrlPreview metaData={metaData} onClose={onClose} />}
        <div className="chat__conversation-panel__container">
          <button
            type="button"
            className="chat__conversation-panel__button panel-item btn-icon add-file-button"
          >
            <svg
              className="feather feather-plus sc-dnqmqq jxshSx"
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
          <button
            type="button"
            className="chat__conversation-panel__button panel-item btn-icon emoji-button"
          >
            <svg
              className="feather feather-smile sc-dnqmqq jxshSx"
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M8 14s1.5 2 4 2 4-2 4-2" />
              <line x1="9" y1="9" x2="9.01" y2="9" />
              <line x1="15" y1="9" x2="15.01" y2="9" />
            </svg>
          </button>
          <input
            className="chat__conversation-panel__input panel-item"
            placeholder="Type a message..."
            onPaste={(e) => inputPasteHandler(e)}
            onChange={(e) => inputChangeHandler(e)}
            onKeyDown={(e) => inputKeyDownHandler(e)}
            value={inputMessage}
          />
          <button
            type="button"
            className="chat__conversation-panel__button panel-item btn-icon send-message-button"
            onClick={chatSubmitHandler}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              data-reactid="1036"
            >
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}

export { ChatWindow }
