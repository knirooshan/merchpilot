import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { LinkPlugin } from "@lexical/react/LexicalLinkPlugin";
import { TabIndentationPlugin } from "@lexical/react/LexicalTabIndentationPlugin";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";

import {
  HeadingNode,
  QuoteNode,
  $createHeadingNode,
  $createQuoteNode,
  $isHeadingNode,
} from "@lexical/rich-text";
import {
  ListNode,
  ListItemNode,
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
  REMOVE_LIST_COMMAND,
  $isListNode,
} from "@lexical/list";
import {
  LinkNode,
  AutoLinkNode,
  TOGGLE_LINK_COMMAND,
  $isLinkNode,
} from "@lexical/link";
import { $setBlocksType } from "@lexical/selection";
import { mergeRegister } from "@lexical/utils";
import { $generateHtmlFromNodes, $generateNodesFromDOM } from "@lexical/html";

import {
  $getRoot,
  $getSelection,
  $isRangeSelection,
  $createParagraphNode,
  FORMAT_TEXT_COMMAND,
  FORMAT_ELEMENT_COMMAND,
  UNDO_COMMAND,
  REDO_COMMAND,
  CAN_UNDO_COMMAND,
  CAN_REDO_COMMAND,
  SELECTION_CHANGE_COMMAND,
  COMMAND_PRIORITY_LOW,
  COMMAND_PRIORITY_CRITICAL,
} from "lexical";

import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Code,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  Quote,
  Heading1,
  Heading2,
  Heading3,
  Link as LinkIcon,
  Unlink,
  Undo,
  Redo,
  ChevronDown,
  X,
  Check,
} from "lucide-react";

const editorTheme = {
  paragraph: "mb-2 leading-relaxed text-slate-800 last:mb-0",
  heading: {
    h1: "text-2xl font-bold text-slate-900 mb-2 mt-1",
    h2: "text-xl font-bold text-slate-900 mb-2 mt-1",
    h3: "text-lg font-semibold text-slate-800 mb-1 mt-1",
  },
  list: {
    ul: "list-disc list-outside ml-5 mb-2 space-y-1 text-slate-800",
    ol: "list-decimal list-outside ml-5 mb-2 space-y-1 text-slate-800",
    listitem: "pl-1",
    nested: {
      listitem: "list-none",
    },
  },
  quote: "border-l-4 border-blue-500 pl-4 py-1 italic text-slate-600 bg-slate-50 my-2 rounded-r",
  link: "text-blue-600 hover:text-blue-800 underline font-medium cursor-pointer",
  text: {
    bold: "font-bold",
    italic: "italic",
    underline: "underline underline-offset-2",
    strikethrough: "line-through text-slate-500",
    underlineStrikethrough: "underline line-through",
    code: "bg-slate-100 text-pink-600 font-mono text-xs px-1.5 py-0.5 rounded border border-slate-200",
  },
};

const BLOCK_TYPES = [
  { id: "paragraph", label: "Normal", icon: null },
  { id: "h1", label: "Heading 1", icon: Heading1 },
  { id: "h2", label: "Heading 2", icon: Heading2 },
  { id: "h3", label: "Heading 3", icon: Heading3 },
  { id: "bullet", label: "Bullet List", icon: List },
  { id: "number", label: "Numbered List", icon: ListOrdered },
  { id: "quote", label: "Quote", icon: Quote },
];

function ToolbarPlugin() {
  const [editor] = useLexicalComposerContext();
  const [blockType, setBlockType] = useState("paragraph");
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);
  const [isStrikethrough, setIsStrikethrough] = useState(false);
  const [isCode, setIsCode] = useState(false);
  const [isLink, setIsLink] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // Dropdown & Popover states
  const [showBlockDropdown, setShowBlockDropdown] = useState(false);
  const [showLinkPopover, setShowLinkPopover] = useState(false);
  const [linkUrlInput, setLinkUrlInput] = useState("");

  const dropdownRef = useRef(null);
  const linkPopoverRef = useRef(null);

  // Close menus on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowBlockDropdown(false);
      }
      if (linkPopoverRef.current && !linkPopoverRef.current.contains(e.target)) {
        setShowLinkPopover(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const updateToolbar = useCallback(() => {
    const selection = $getSelection();
    if ($isRangeSelection(selection)) {
      setIsBold(selection.hasFormat("bold"));
      setIsItalic(selection.hasFormat("italic"));
      setIsUnderline(selection.hasFormat("underline"));
      setIsStrikethrough(selection.hasFormat("strikethrough"));
      setIsCode(selection.hasFormat("code"));

      // Check link
      const anchorNode = selection.anchor.getNode();
      const parent = anchorNode.getParent();
      setIsLink($isLinkNode(anchorNode) || $isLinkNode(parent));

      // Check block type
      const topLevelElement = anchorNode.getTopLevelElement();
      if (topLevelElement) {
        if ($isListNode(topLevelElement)) {
          setBlockType(topLevelElement.getListType() === "number" ? "number" : "bullet");
        } else if ($isHeadingNode(topLevelElement)) {
          setBlockType(topLevelElement.getTag());
        } else if (topLevelElement.getType() === "quote") {
          setBlockType("quote");
        } else {
          setBlockType("paragraph");
        }
      }
    }
  }, []);

  useEffect(() => {
    return mergeRegister(
      editor.registerUpdateListener(({ editorState }) => {
        editorState.read(() => {
          updateToolbar();
        });
      }),
      editor.registerCommand(
        SELECTION_CHANGE_COMMAND,
        () => {
          updateToolbar();
          return false;
        },
        COMMAND_PRIORITY_LOW
      ),
      editor.registerCommand(
        CAN_UNDO_COMMAND,
        (payload) => {
          setCanUndo(payload);
          return false;
        },
        COMMAND_PRIORITY_CRITICAL
      ),
      editor.registerCommand(
        CAN_REDO_COMMAND,
        (payload) => {
          setCanRedo(payload);
          return false;
        },
        COMMAND_PRIORITY_CRITICAL
      )
    );
  }, [editor, updateToolbar]);

  // Block Formatting handlers
  const handleSelectBlockType = (type) => {
    setShowBlockDropdown(false);
    if (type === blockType) return;

    if (type === "bullet") {
      editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined);
    } else if (type === "number") {
      editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined);
    } else {
      if (blockType === "bullet" || blockType === "number") {
        editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined);
      }
      editor.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          if (type === "h1" || type === "h2" || type === "h3") {
            $setBlocksType(selection, () => $createHeadingNode(type));
          } else if (type === "quote") {
            $setBlocksType(selection, () => $createQuoteNode());
          } else {
            $setBlocksType(selection, () => $createParagraphNode());
          }
        }
      });
    }
  };

  // Link Popover handlers
  const openLinkPopover = () => {
    let existingUrl = "";
    editor.getEditorState().read(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        const node = selection.anchor.getNode();
        const parent = node.getParent();
        if ($isLinkNode(parent)) {
          existingUrl = parent.getURL();
        } else if ($isLinkNode(node)) {
          existingUrl = node.getURL();
        }
      }
    });

    setLinkUrlInput(existingUrl);
    setShowLinkPopover(true);
  };

  const handleApplyLink = (e) => {
    if (e) e.preventDefault();
    if (!linkUrlInput.trim()) {
      editor.dispatchCommand(TOGGLE_LINK_COMMAND, null);
    } else {
      let formatted = linkUrlInput.trim();
      if (
        !/^https?:\/\//i.test(formatted) &&
        !formatted.startsWith("mailto:") &&
        !formatted.startsWith("tel:")
      ) {
        formatted = "https://" + formatted;
      }
      editor.dispatchCommand(TOGGLE_LINK_COMMAND, {
        url: formatted,
        target: "_blank",
        rel: "noopener noreferrer",
      });
    }
    setShowLinkPopover(false);
    setLinkUrlInput("");
  };

  const handleRemoveLink = () => {
    editor.dispatchCommand(TOGGLE_LINK_COMMAND, null);
    setShowLinkPopover(false);
    setLinkUrlInput("");
  };

  const currentBlockLabel =
    BLOCK_TYPES.find((b) => b.id === blockType)?.label || "Normal";

  return (
    <div className="bg-slate-50 border-b border-slate-200 px-2 py-1.5 flex flex-wrap items-center gap-1 text-slate-700 select-none text-xs">
      {/* Undo / Redo */}
      <div className="flex items-center space-x-0.5">
        <button
          type="button"
          onClick={() => editor.dispatchCommand(UNDO_COMMAND, undefined)}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
          className="p-1.5 rounded hover:bg-slate-200 disabled:opacity-35 disabled:hover:bg-transparent transition-colors text-slate-600"
        >
          <Undo className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => editor.dispatchCommand(REDO_COMMAND, undefined)}
          disabled={!canRedo}
          title="Redo (Ctrl+Y)"
          className="p-1.5 rounded hover:bg-slate-200 disabled:opacity-35 disabled:hover:bg-transparent transition-colors text-slate-600"
        >
          <Redo className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="h-4 w-px bg-slate-300 mx-0.5" />

      {/* Block Type Dropdown */}
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setShowBlockDropdown(!showBlockDropdown)}
          className="flex items-center gap-1 px-2 py-1 rounded bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-medium transition-colors shadow-2xs"
          title="Text Style"
        >
          <span>{currentBlockLabel}</span>
          <ChevronDown className="w-3 h-3 text-slate-400" />
        </button>

        {showBlockDropdown && (
          <div className="absolute left-0 top-full mt-1 w-44 bg-white border border-slate-200 rounded-md shadow-lg z-50 py-1">
            {BLOCK_TYPES.map((item) => {
              const Icon = item.icon;
              const isSelected = blockType === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelectBlockType(item.id)}
                  className={`w-full flex items-center px-3 py-1.5 text-left text-xs transition-colors ${isSelected
                      ? "bg-blue-50 text-blue-600 font-semibold"
                      : "text-slate-700 hover:bg-slate-100"
                    }`}
                >
                  {Icon ? (
                    <Icon className="w-3.5 h-3.5 mr-2 shrink-0 text-slate-500" />
                  ) : (
                    <span className="w-3.5 mr-2" />
                  )}
                  {item.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="h-4 w-px bg-slate-300 mx-0.5" />

      {/* Inline Formatting */}
      <div className="flex items-center space-x-0.5">
        <button
          type="button"
          onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "bold")}
          title="Bold (Ctrl+B)"
          className={`p-1.5 rounded transition-colors ${isBold
              ? "bg-blue-100 text-blue-700 font-bold"
              : "text-slate-600 hover:bg-slate-200"
            }`}
        >
          <Bold className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "italic")}
          title="Italic (Ctrl+I)"
          className={`p-1.5 rounded transition-colors ${isItalic
              ? "bg-blue-100 text-blue-700"
              : "text-slate-600 hover:bg-slate-200"
            }`}
        >
          <Italic className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "underline")}
          title="Underline (Ctrl+U)"
          className={`p-1.5 rounded transition-colors ${isUnderline
              ? "bg-blue-100 text-blue-700"
              : "text-slate-600 hover:bg-slate-200"
            }`}
        >
          <Underline className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "strikethrough")}
          title="Strikethrough"
          className={`p-1.5 rounded transition-colors ${isStrikethrough
              ? "bg-blue-100 text-blue-700"
              : "text-slate-600 hover:bg-slate-200"
            }`}
        >
          <Strikethrough className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "code")}
          title="Inline Code"
          className={`p-1.5 rounded transition-colors ${isCode
              ? "bg-blue-100 text-blue-700"
              : "text-slate-600 hover:bg-slate-200"
            }`}
        >
          <Code className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="h-4 w-px bg-slate-300 mx-0.5" />

      {/* Lists */}
      <div className="flex items-center space-x-0.5">
        <button
          type="button"
          onClick={() =>
            blockType === "bullet"
              ? editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined)
              : editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined)
          }
          title="Bulleted List"
          className={`p-1.5 rounded transition-colors ${blockType === "bullet"
              ? "bg-blue-100 text-blue-700"
              : "text-slate-600 hover:bg-slate-200"
            }`}
        >
          <List className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() =>
            blockType === "number"
              ? editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined)
              : editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined)
          }
          title="Numbered List"
          className={`p-1.5 rounded transition-colors ${blockType === "number"
              ? "bg-blue-100 text-blue-700"
              : "text-slate-600 hover:bg-slate-200"
            }`}
        >
          <ListOrdered className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => handleSelectBlockType(blockType === "quote" ? "paragraph" : "quote")}
          title="Blockquote"
          className={`p-1.5 rounded transition-colors ${blockType === "quote"
              ? "bg-blue-100 text-blue-700"
              : "text-slate-600 hover:bg-slate-200"
            }`}
        >
          <Quote className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="h-4 w-px bg-slate-300 mx-0.5" />

      {/* Alignment */}
      <div className="flex items-center space-x-0.5">
        <button
          type="button"
          onClick={() => editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, "left")}
          title="Align Left"
          className="p-1.5 rounded text-slate-600 hover:bg-slate-200 transition-colors"
        >
          <AlignLeft className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, "center")}
          title="Align Center"
          className="p-1.5 rounded text-slate-600 hover:bg-slate-200 transition-colors"
        >
          <AlignCenter className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, "right")}
          title="Align Right"
          className="p-1.5 rounded text-slate-600 hover:bg-slate-200 transition-colors"
        >
          <AlignRight className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, "justify")}
          title="Align Justify"
          className="p-1.5 rounded text-slate-600 hover:bg-slate-200 transition-colors"
        >
          <AlignJustify className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="h-4 w-px bg-slate-300 mx-0.5" />

      {/* Link Popover */}
      <div className="relative" ref={linkPopoverRef}>
        <button
          type="button"
          onClick={openLinkPopover}
          title={isLink ? "Edit Link" : "Insert Link"}
          className={`p-1.5 rounded transition-colors ${isLink
              ? "bg-blue-100 text-blue-700"
              : "text-slate-600 hover:bg-slate-200"
            }`}
        >
          <LinkIcon className="w-3.5 h-3.5" />
        </button>

        {showLinkPopover && (
          <form
            onSubmit={handleApplyLink}
            className="absolute left-0 top-full mt-1 w-72 bg-white border border-slate-200 rounded-md shadow-xl z-50 p-2.5 space-y-2"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
              <span className="text-xs font-semibold text-slate-700">
                {isLink ? "Edit Link" : "Insert Link"}
              </span>
              <button
                type="button"
                onClick={() => setShowLinkPopover(false)}
                className="text-slate-400 hover:text-slate-600 p-0.5 rounded"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={linkUrlInput}
                onChange={(e) => setLinkUrlInput(e.target.value)}
                placeholder="https://example.com"
                autoFocus
                className="flex-1 px-2.5 py-1 text-xs border border-slate-300 rounded focus:border-blue-500 focus:outline-none"
              />
              <button
                type="submit"
                className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium transition-colors"
                title="Save Link"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
            </div>
            {isLink && (
              <div className="pt-1 border-t border-slate-100 flex justify-end">
                <button
                  type="button"
                  onClick={handleRemoveLink}
                  className="flex items-center gap-1 text-[11px] text-red-600 hover:text-red-700 font-medium"
                >
                  <Unlink className="w-3 h-3" />
                  Remove Link
                </button>
              </div>
            )}
          </form>
        )}
      </div>
    </div>
  );
}

function HtmlSyncPlugin({ value, onChange }) {
  const [editor] = useLexicalComposerContext();
  const lastEmittedValueRef = useRef(value || "");
  const isUpdatingFromPropRef = useRef(false);

  // Sync external value changes into Lexical editor
  useEffect(() => {
    const currentVal = value || "";
    if (currentVal !== lastEmittedValueRef.current) {
      lastEmittedValueRef.current = currentVal;
      isUpdatingFromPropRef.current = true;
      editor.update(() => {
        const root = $getRoot();
        root.clear();
        if (currentVal.trim()) {
          try {
            const parser = new DOMParser();
            const dom = parser.parseFromString(currentVal, "text/html");
            const nodes = $generateNodesFromDOM(editor, dom);
            if (nodes.length > 0) {
              root.append(...nodes);
            } else {
              root.append($createParagraphNode());
            }
          } catch {
            root.append($createParagraphNode());
          }
        } else {
          root.append($createParagraphNode());
        }
      });
      isUpdatingFromPropRef.current = false;
    }
  }, [value, editor]);

  // Listen to editor changes and emit updated HTML
  useEffect(() => {
    return editor.registerUpdateListener(
      ({ editorState, dirtyElements, dirtyLeaves }) => {
        if (isUpdatingFromPropRef.current) return;
        if (dirtyElements.size === 0 && dirtyLeaves.size === 0) return;

        editorState.read(() => {
          const root = $getRoot();
          const text = root.getTextContent().trim();
          let html = "";
          if (text.length > 0) {
            html = $generateHtmlFromNodes(editor, null);
          } else {
            const children = root.getChildren();
            if (
              children.length === 0 ||
              (children.length === 1 &&
                children[0].getTextContent().trim() === "")
            ) {
              html = "";
            } else {
              const raw = $generateHtmlFromNodes(editor, null);
              if (
                raw === "<p></p>" ||
                raw === "<p><br></p>" ||
                raw === '<p class="editor-paragraph"><br></p>'
              ) {
                html = "";
              } else {
                html = raw;
              }
            }
          }

          if (html !== lastEmittedValueRef.current) {
            lastEmittedValueRef.current = html;
            if (onChange) {
              onChange(html);
            }
          }
        });
      }
    );
  }, [editor, onChange]);

  return null;
}

const RichTextEditor = ({ value, onChange, placeholder, className }) => {
  const initialConfig = useMemo(
    () => ({
      namespace: "MerchPilotRichTextEditor",
      theme: editorTheme,
      onError(error) {
        console.error("Lexical error:", error);
      },
      nodes: [
        HeadingNode,
        QuoteNode,
        ListNode,
        ListItemNode,
        LinkNode,
        AutoLinkNode,
      ],
      editorState: (editor) => {
        if (value && typeof value === "string") {
          try {
            const parser = new DOMParser();
            const dom = parser.parseFromString(value, "text/html");
            const nodes = $generateNodesFromDOM(editor, dom);
            const root = $getRoot();
            root.clear();
            if (nodes.length > 0) {
              root.append(...nodes);
            } else {
              root.append($createParagraphNode());
            }
          } catch (e) {
            console.error("Failed to parse initial HTML into Lexical:", e);
          }
        }
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  return (
    <div
      className={`flex flex-col bg-white rounded-md border border-slate-300 text-slate-900 overflow-hidden focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition-colors shadow-2xs ${className || "min-h-[200px]"
        }`}
    >
      <LexicalComposer initialConfig={initialConfig}>
        <ToolbarPlugin />
        <div className="relative flex-1 overflow-y-auto lexical-editor">
          <RichTextPlugin
            contentEditable={
              <ContentEditable className="outline-none min-h-[90px] p-3 text-slate-800 text-sm leading-relaxed" />
            }
            placeholder={
              <div className="absolute top-3 left-3 text-slate-400 text-sm pointer-events-none select-none">
                {placeholder || "Enter text..."}
              </div>
            }
            ErrorBoundary={LexicalErrorBoundary}
          />
          <HistoryPlugin />
          <ListPlugin />
          <LinkPlugin />
          <TabIndentationPlugin />
          <HtmlSyncPlugin value={value} onChange={onChange} />
        </div>
      </LexicalComposer>
    </div>
  );
};

export default RichTextEditor;
