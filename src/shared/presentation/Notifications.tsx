import { Slide, ToastContainer } from "react-toastify"
import "react-toastify/dist/ReactToastify.css"
export default function Notifications() {
  return (
    <ToastContainer
      position="top-right"
      autoClose={5000}
      limit={3}
      newestOnTop
      pauseOnFocusLoss
      pauseOnHover
      closeOnClick={false}
      theme="light"
      transition={Slide}
      aria-label="Notificações do sistema"
      role="status"
    />
  )
}
