import { useEffect, useRef, type MouseEvent } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import { createLowlight } from "lowlight";
import javascript from "highlight.js/lib/languages/javascript";
import typescript from "highlight.js/lib/languages/typescript";
import python from "highlight.js/lib/languages/python";
import java from "highlight.js/lib/languages/java";
import cpp from "highlight.js/lib/languages/cpp";
import csharp from "highlight.js/lib/languages/csharp";
import php from "highlight.js/lib/languages/php";
import sql from "highlight.js/lib/languages/sql";
import html from "highlight.js/lib/languages/xml";
import css from "highlight.js/lib/languages/css";
import json from "highlight.js/lib/languages/json";
import bash from "highlight.js/lib/languages/bash";

const lowlight = createLowlight();
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- highlight.js language modules have incompatible types
lowlight.register("javascript", javascript as any);
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- highlight.js language modules have incompatible types
lowlight.register("typescript", typescript as any);
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- highlight.js language modules have incompatible types
lowlight.register("python", python as any);
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- highlight.js language modules have incompatible types
lowlight.register("java", java as any);
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- highlight.js language modules have incompatible types
lowlight.register("cpp", cpp as any);
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- highlight.js language modules have incompatible types
lowlight.register("csharp", csharp as any);
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- highlight.js language modules have incompatible types
lowlight.register("php", php as any);
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- highlight.js language modules have incompatible types
lowlight.register("sql", sql as any);
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- highlight.js language modules have incompatible types
lowlight.register("html", html as any);
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- highlight.js language modules have incompatible types
lowlight.register("xml", html as any);
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- highlight.js language modules have incompatible types
lowlight.register("css", css as any);
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- highlight.js language modules have incompatible types
lowlight.register("json", json as any);
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- highlight.js language modules have incompatible types
lowlight.register("bash", bash as any);
import { Button } from "@/components/ui/button";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  List,
  ListOrdered,
  Code,
  Image as ImageIcon,
  Link as LinkIcon,
  Undo,
  Redo,
  Heading1,
  Heading2,
  Quote,
} from "lucide-react";
import { Toggle } from "@/components/ui/toggle";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  className?: string;
}

export const RichTextEditor = ({ content, onChange, placeholder, className }: RichTextEditorProps) => {
  const onChangeRef = useRef(onChange);
  const isApplyingExternalContentRef = useRef(false);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false, // We'll use CodeBlockLowlight instead
      }),
      CodeBlockLowlight.configure({
        lowlight,
        defaultLanguage: "javascript",
      }),
      Image.configure({
        inline: true,
        allowBase64: true,
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-primary underline",
        },
      }),
      Underline,
    ],
    content,
    onUpdate: ({ editor }) => {
      if (isApplyingExternalContentRef.current) {
        return;
      }

      const html = editor.getHTML();
      onChangeRef.current(html === "<p></p>" ? "" : html);
    },
    editorProps: {
      attributes: {
        class: cn(
          "prose prose-sm sm:prose-base lg:prose-lg xl:prose-2xl mx-auto focus:outline-none min-h-[300px] p-4",
          "prose-headings:font-semibold",
          "prose-ul:my-4 prose-ul:list-disc prose-ul:pl-6",
          "prose-ol:my-4 prose-ol:list-decimal prose-ol:pl-6",
          "prose-li:my-1 prose-li:leading-7",
          "prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-sm",
          "prose-pre:bg-muted prose-pre:p-4 prose-pre:rounded-lg",
          "prose-img:rounded-lg prose-img:shadow-md",
          "[&_ul_ul]:my-2 [&_ul_ul]:list-[circle] [&_ul_ul]:pl-6",
          "[&_ol_ol]:my-2 [&_ol_ol]:list-[lower-alpha] [&_ol_ol]:pl-6",
          "[&_ol_ul]:my-2 [&_ol_ul]:list-disc [&_ol_ul]:pl-6",
          "[&_ul_ol]:my-2 [&_ul_ol]:list-decimal [&_ul_ol]:pl-6",
          "[&_p:empty]:block [&_p:empty]:h-6",
          className
        ),
        "data-placeholder": placeholder || "Start typing your content here... e.g., Introduction to JavaScript",
      },
    },
  });

  useEffect(() => {
    if (!editor || editor.isDestroyed) {
      return;
    }

    const nextContent = content?.trim() ? content : "<p></p>";
    if (editor.getHTML() !== nextContent) {
      isApplyingExternalContentRef.current = true;
      editor.commands.setContent(nextContent, false);
      queueMicrotask(() => {
        isApplyingExternalContentRef.current = false;
      });
    }
  }, [content, editor]);

  if (!editor) {
    return null;
  }

  const addImage = () => {
    const url = window.prompt("Enter image URL:");
    if (url) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  };

  const addLink = () => {
    const url = window.prompt("Enter URL:");
    if (url) {
      editor.chain().focus().setLink({ href: url }).run();
    }
  };

  const preventToolbarMouseDown = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
  };

  const runToolbarCommand = (command: () => boolean) => (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    command();
  };

  return (
    <div className={cn("border rounded-lg overflow-hidden w-full min-w-0", className)}>
      {/* Toolbar */}
      <div className="border-b bg-muted/50 p-2 flex flex-wrap items-center gap-1">
        <Toggle
          pressed={editor.isActive("heading", { level: 1 })}
          onMouseDown={preventToolbarMouseDown}
          onClick={runToolbarCommand(() => editor.chain().focus().toggleHeading({ level: 1 }).run())}
          size="sm"
          aria-label="Heading 1"
        >
          <Heading1 className="w-4 h-4" />
        </Toggle>
        <Toggle
          pressed={editor.isActive("heading", { level: 2 })}
          onMouseDown={preventToolbarMouseDown}
          onClick={runToolbarCommand(() => editor.chain().focus().toggleHeading({ level: 2 }).run())}
          size="sm"
          aria-label="Heading 2"
        >
          <Heading2 className="w-4 h-4" />
        </Toggle>
        <Separator orientation="vertical" className="h-6" />
        <Toggle
          pressed={editor.isActive("bold")}
          onMouseDown={preventToolbarMouseDown}
          onClick={runToolbarCommand(() => editor.chain().focus().toggleBold().run())}
          size="sm"
          aria-label="Bold"
        >
          <Bold className="w-4 h-4" />
        </Toggle>
        <Toggle
          pressed={editor.isActive("italic")}
          onMouseDown={preventToolbarMouseDown}
          onClick={runToolbarCommand(() => editor.chain().focus().toggleItalic().run())}
          size="sm"
          aria-label="Italic"
        >
          <Italic className="w-4 h-4" />
        </Toggle>
        <Toggle
          pressed={editor.isActive("underline")}
          onMouseDown={preventToolbarMouseDown}
          onClick={runToolbarCommand(() => editor.chain().focus().toggleUnderline().run())}
          size="sm"
          aria-label="Underline"
        >
          <UnderlineIcon className="w-4 h-4" />
        </Toggle>
        <Toggle
          pressed={editor.isActive("code")}
          onMouseDown={preventToolbarMouseDown}
          onClick={runToolbarCommand(() => editor.chain().focus().toggleCode().run())}
          size="sm"
          aria-label="Inline Code"
        >
          <Code className="w-4 h-4" />
        </Toggle>
        <Separator orientation="vertical" className="h-6" />
        <Toggle
          pressed={editor.isActive("bulletList")}
          onMouseDown={preventToolbarMouseDown}
          onClick={runToolbarCommand(() => editor.chain().focus().toggleBulletList().run())}
          size="sm"
          aria-label="Bullet List"
        >
          <List className="w-4 h-4" />
        </Toggle>
        <Toggle
          pressed={editor.isActive("orderedList")}
          onMouseDown={preventToolbarMouseDown}
          onClick={runToolbarCommand(() => editor.chain().focus().toggleOrderedList().run())}
          size="sm"
          aria-label="Ordered List"
        >
          <ListOrdered className="w-4 h-4" />
        </Toggle>
        <Toggle
          pressed={editor.isActive("blockquote")}
          onMouseDown={preventToolbarMouseDown}
          onClick={runToolbarCommand(() => editor.chain().focus().toggleBlockquote().run())}
          size="sm"
          aria-label="Quote"
        >
          <Quote className="w-4 h-4" />
        </Toggle>
        <Separator orientation="vertical" className="h-6" />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onMouseDown={preventToolbarMouseDown}
          onClick={runToolbarCommand(() => editor.chain().focus().toggleCodeBlock().run())}
          className={editor.isActive("codeBlock") ? "bg-muted" : ""}
        >
          <Code className="w-4 h-4 mr-1" />
          Code Block
        </Button>
        <Button type="button" variant="ghost" size="sm" onMouseDown={preventToolbarMouseDown} onClick={runToolbarCommand(() => {
          addImage();
          return true;
        })}>
          <ImageIcon className="w-4 h-4 mr-1" />
          Image
        </Button>
        <Button type="button" variant="ghost" size="sm" onMouseDown={preventToolbarMouseDown} onClick={runToolbarCommand(() => {
          addLink();
          return true;
        })}>
          <LinkIcon className="w-4 h-4 mr-1" />
          Link
        </Button>
        <Separator orientation="vertical" className="h-6" />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onMouseDown={preventToolbarMouseDown}
          onClick={runToolbarCommand(() => editor.chain().focus().undo().run())}
          disabled={!editor.can().undo()}
        >
          <Undo className="w-4 h-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onMouseDown={preventToolbarMouseDown}
          onClick={runToolbarCommand(() => editor.chain().focus().redo().run())}
          disabled={!editor.can().redo()}
        >
          <Redo className="w-4 h-4" />
        </Button>
      </div>

      {/* Editor Content */}
      <div className="min-h-[300px] max-h-[600px] overflow-y-auto relative">
        <EditorContent editor={editor} />
        {!content && placeholder && (
          <div 
            className="absolute top-4 left-4 text-muted-foreground pointer-events-none select-none"
            style={{ 
              zIndex: 1,
              whiteSpace: 'pre-wrap',
              wordWrap: 'break-word'
            }}
          >
            {placeholder}
          </div>
        )}
      </div>
    </div>
  );
};

