// THE single source of ProseMirror for the renderer. Every module imports PM from
// here so only one copy of prosemirror-model/state/view/transform is ever loaded.
export { DOMSerializer } from 'prosemirror-model'
export type { Schema, Node as PMNode } from 'prosemirror-model'
export { EditorState, Plugin, PluginKey, TextSelection, NodeSelection, Selection } from 'prosemirror-state'
export { EditorView, Decoration, DecorationSet } from 'prosemirror-view'
export { keymap } from 'prosemirror-keymap'
export { baseKeymap } from 'prosemirror-commands'
