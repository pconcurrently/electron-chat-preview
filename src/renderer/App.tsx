import { MemoryRouter as Router, Routes, Route } from 'react-router-dom'
import './App.scss'

import { ChatWindow } from './ChatWindow'

function Hello() {
  return <ChatWindow />
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Hello />} />
      </Routes>
    </Router>
  )
}
