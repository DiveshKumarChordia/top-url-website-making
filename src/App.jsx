import { Route, Routes } from 'react-router-dom'
import './App.css'
import { Layout } from './components/Layout.jsx'
import EntryPage from './pages/EntryPage.jsx'
import HomePage from './pages/HomePage.jsx'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="entry/:contentTypeUid/:entryUid" element={<EntryPage />} />
      </Route>
    </Routes>
  )
}
