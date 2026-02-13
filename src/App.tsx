import './App.css'
import { Navigate, Route, Routes } from 'react-router-dom'

import AppShell from './components/AppShell'
import ProtectedRoute from './components/ProtectedRoute'
import RequireRole from './components/RequireRole'
import BranchPage from './pages/BranchPage'
import DashboardPage from './pages/DashboardPage'
import FileManagerPage from './pages/FileManagerPage'
import LoginPage from './pages/LoginPage'
import MeetPage from './pages/MeetPage'
import OnlyOfficeEditorPage from './pages/OnlyOfficeEditorPage'
import OperationsPage from './pages/OperationsPage'
import SharedFilesPage from './pages/SharedFilesPage'
import SettingsPage from './pages/SettingsPage'
import UploadPage from './pages/UploadPage'
import UsersPage from './pages/UsersPage'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<ProtectedRoute />}>
        <Route path="/editor" element={<OnlyOfficeEditorPage />} />
        <Route element={<AppShell />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/file-manager" element={<FileManagerPage />} />
          <Route path="/shared-files" element={<SharedFilesPage />} />
          <Route path="/upload" element={<UploadPage />} />

          <Route element={<RequireRole roles={["SUPER_ADMIN", "BRANCH_MANAGER"]} />}>
            <Route path="/meet" element={<MeetPage />} />
          </Route>

          <Route element={<RequireRole roles={["SUPER_ADMIN", "BRANCH_MANAGER", "COORDINATOR"]} />}>
            <Route path="/users" element={<UsersPage />} />
            <Route path="/branches" element={<BranchPage />} />
          </Route>

          <Route path="/settings" element={<SettingsPage />} />

          <Route element={<RequireRole roles={["BRANCH_MANAGER", "COORDINATOR"]} />}>
            <Route path="/branch" element={<Navigate to="/branches" replace />} />
          </Route>

          <Route
            element={<RequireRole roles={["CASHIER", "LOAN_OFFICER", "CUSTOMER_RELATION"]} />}
          >
            <Route path="/operations" element={<OperationsPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
