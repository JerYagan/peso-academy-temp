import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
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
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: cn(
          "prose prose-sm sm:prose-base lg:prose-lg xl:prose-2xl mx-auto focus:outline-none min-h-[300px] p-4",
          "prose-headings:font-semibold",
          "prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-sm",
          "prose-pre:bg-muted prose-pre:p-4 prose-pre:rounded-lg",
          "prose-img:rounded-lg prose-img:shadow-md",
          className
        ),
      },
    },
  });

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

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Toolbar */}
      <div className="border-b bg-muted/50 p-2 flex flex-wrap items-center gap-1">
        <Toggle
          pressed={editor.isActive("heading", { level: 1 })}
          onPressedChange={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          size="sm"
          aria-label="Heading 1"
        >
          <Heading1 className="w-4 h-4" />
        </Toggle>
        <Toggle
          pressed={editor.isActive("heading", { level: 2 })}
          onPressedChange={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          size="sm"
          aria-label="Heading 2"
        >
          <Heading2 className="w-4 h-4" />
        </Toggle>
        <Separator orientation="vertical" className="h-6" />
        <Toggle
          pressed={editor.isActive("bold")}
          onPressedChange={() => editor.chain().focus().toggleBold().run()}
          size="sm"
          aria-label="Bold"
        >
          <Bold className="w-4 h-4" />
        </Toggle>
        <Toggle
          pressed={editor.isActive("italic")}
          onPressedChange={() => editor.chain().focus().toggleItalic().run()}
          size="sm"
          aria-label="Italic"
        >
          <Italic className="w-4 h-4" />
        </Toggle>
        <Toggle
          pressed={editor.isActive("code")}
          onPressedChange={() => editor.chain().focus().toggleCode().run()}
          size="sm"
          aria-label="Inline Code"
        >
          <Code className="w-4 h-4" />
        </Toggle>
        <Separator orientation="vertical" className="h-6" />
        <Toggle
          pressed={editor.isActive("bulletList")}
          onPressedChange={() => editor.chain().focus().toggleBulletList().run()}
          size="sm"
          aria-label="Bullet List"
        >
          <List className="w-4 h-4" />
        </Toggle>
        <Toggle
          pressed={editor.isActive("orderedList")}
          onPressedChange={() => editor.chain().focus().toggleOrderedList().run()}
          size="sm"
          aria-label="Ordered List"
        >
          <ListOrdered className="w-4 h-4" />
        </Toggle>
        <Toggle
          pressed={editor.isActive("blockquote")}
          onPressedChange={() => editor.chain().focus().toggleBlockquote().run()}
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
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          className={editor.isActive("codeBlock") ? "bg-muted" : ""}
        >
          <Code className="w-4 h-4 mr-1" />
          Code Block
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={addImage}>
          <ImageIcon className="w-4 h-4 mr-1" />
          Image
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={addLink}>
          <LinkIcon className="w-4 h-4 mr-1" />
          Link
        </Button>
        <Separator orientation="vertical" className="h-6" />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
        >
          <Undo className="w-4 h-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
        >
          <Redo className="w-4 h-4" />
        </Button>
      </div>

      {/* Editor Content */}
      <div className="min-h-[300px] max-h-[600px] overflow-y-auto">
        <EditorContent editor={editor} />
        {!content && placeholder && (
          <div className="absolute top-4 left-4 text-muted-foreground pointer-events-none">
            {placeholder}
          </div>
        )}
      </div>
    </div>
  );
};

