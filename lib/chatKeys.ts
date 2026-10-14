// Enter submits only after IME composition has finished; Shift+Enter is a newline.
export function shouldSubmitChat(event: {
  key: string;
  shiftKey: boolean;
  keyCode?: number;
  nativeEvent?: { isComposing?: boolean; keyCode?: number };
}): boolean {
  return event.key === 'Enter' && !event.shiftKey &&
    !event.nativeEvent?.isComposing &&
    event.keyCode !== 229 && event.nativeEvent?.keyCode !== 229;
}
