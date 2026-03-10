import { useRef, useEffect, useCallback } from 'react';

interface SimpleRichEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: string;
  className?: string;
}

/**
 * Lightweight HTML editor using contentEditable + toolbar.
 * Compatible with React 19 (no findDOMNode). Replaces react-quill for Guidelines.
 */
export function SimpleRichEditor({ value, onChange, placeholder = '', minHeight = '320px', className = '' }: SimpleRichEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    if (el.innerHTML !== value) {
      el.innerHTML = value || '';
    }
  }, [value]);

  const emitChange = useCallback(() => {
    const html = editorRef.current?.innerHTML ?? '';
    onChange(html);
  }, [onChange]);

  const exec = (cmd: string, value?: string) => {
    document.execCommand(cmd, false, value);
    editorRef.current?.focus();
    emitChange();
  };

  const addLink = () => {
    const url = window.prompt('Enter URL:');
    if (url) exec('createLink', url);
  };

  return (
    <div className={`simple-rich-editor ${className}`}>
      <div className="simple-rich-editor-toolbar" role="toolbar">
        <select
          onChange={(e) => {
            const v = e.target.value;
            e.target.value = '';
            if (v) exec('formatBlock', v);
          }}
          title="Heading"
          aria-label="Format"
        >
          <option value="">Paragraph</option>
          <option value="h1">Heading 1</option>
          <option value="h2">Heading 2</option>
          <option value="h3">Heading 3</option>
        </select>
        <button type="button" onClick={() => exec('bold')} title="Bold" aria-label="Bold"><b>B</b></button>
        <button type="button" onClick={() => exec('italic')} title="Italic" aria-label="Italic"><i>I</i></button>
        <button type="button" onClick={() => exec('underline')} title="Underline" aria-label="Underline"><u>U</u></button>
        <button type="button" onClick={() => exec('insertUnorderedList')} title="Bullet list" aria-label="Bullet list">• List</button>
        <button type="button" onClick={() => exec('insertOrderedList')} title="Numbered list" aria-label="Numbered list">1. List</button>
        <button type="button" onClick={addLink} title="Insert link" aria-label="Insert link">Link</button>
      </div>
      <div
        ref={editorRef}
        className="simple-rich-editor-body"
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder}
        onInput={emitChange}
        onBlur={emitChange}
        style={{ minHeight }}
      />
    </div>
  );
}
