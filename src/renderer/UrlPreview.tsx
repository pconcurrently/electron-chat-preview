import React from 'react'
import './UrlPreview.scss'
import { MetaData } from 'main/urlScrape'
import DefaultImage from './default.jpg'
type UrlPreviewProps = {
  metaData: MetaData
  onClose: () => void
}

const UrlPreview = ({ metaData, onClose }: UrlPreviewProps) => {
  return (
    <div className="url-preview">
      <div className="image">
        <img src={metaData.blobUrl || DefaultImage} alt="preview" />
      </div>
      <div className="content">
        <div className="title">
          {metaData.title}
        </div>
        <div className="description">
          {metaData.description}
        </div>
          <div className="close" role='button' onClick={onClose}>
          x
        </div>
      </div>
    </div>
  )
}

export { UrlPreview }
