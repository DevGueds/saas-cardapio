import { toast } from "react-toastify"
export function notifySuccess(message: string) {
  toast.success(message, { toastId: message, role: "status" })
}
export function notifyInfo(message: string) {
  toast.info(message, { toastId: message, role: "status" })
}
