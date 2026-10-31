import { ref } from 'vue'

export function useClipboard() {
  const copied = ref('')
  async function copy(text, key = text) {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const el = Object.assign(document.createElement('textarea'), { value: text })
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      el.remove()
    }
    copied.value = key
    setTimeout(() => { if (copied.value === key) copied.value = '' }, 1500)
  }
  return { copied, copy }
}
