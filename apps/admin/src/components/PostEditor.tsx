import { useEffect, useMemo, useRef, useState } from "react";
import {
  Button,
  Field,
  Input,
  Tab,
  TabList,
  Textarea,
  Toolbar,
  ToolbarButton,
  Tooltip,
} from "@fluentui/react-components";
import {
  ArrowUndo20Regular,
  ArrowRedo20Regular,
  TextBold20Regular,
  TextItalic20Regular,
  TextUnderline20Regular,
  TextStrikethrough20Regular,
  TextBulletListLtr20Regular,
  TextNumberListLtr20Regular,
  TextBulletListSquare20Regular,
  TextAlignLeft20Regular,
  TextAlignCenter20Regular,
  TextAlignRight20Regular,
  Code20Regular,
  Link20Regular,
  Image20Regular,
  Table20Regular,
  Save20Regular,
  Send20Regular,
  Eye20Regular,
  Dismiss20Regular,
  Delete20Regular,
  Add20Regular,
} from "@fluentui/react-icons";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableHeader } from "@tiptap/extension-table-header";
import { TableCell } from "@tiptap/extension-table-cell";
import TextAlign from "@tiptap/extension-text-align";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";
import DOMPurify from "dompurify";
import { marked } from "marked";
import {
  excerptFromMarkdown,
  postSchema,
  slugify,
  type Post,
} from "@brendon/shared";
import { newPost } from "../seed";
import { useDraft } from "../hooks";
import { api, draftsApi } from "../api";
import { optimizeImage } from "../media";
import { SaveStatus } from "./SaveStatus";

const turndown = new TurndownService({
  headingStyle: "atx",
  bulletListMarker: "-",
  codeBlockStyle: "fenced",
});
turndown.use(gfm);
turndown.addRule("underline", {
  filter: ["u"],
  replacement: (content) => content,
});
function Tool({
  label,
  icon,
  onClick,
  active = false,
  disabled = false,
}: {
  label: string;
  icon: React.ReactElement;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <Tooltip content={label} relationship="label">
      <ToolbarButton
        aria-label={label}
        icon={icon}
        onClick={onClick}
        appearance={active ? "primary" : "subtle"}
        disabled={disabled}
      />
    </Tooltip>
  );
}
export function PostEditor() {
  const [selected, setSelected] = useState("new-post");
  const [preview, setPreview] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [message, setMessage] = useState("");
  const imageRef = useRef<HTMLInputElement>(null);
  const loadedPostId = useRef("");
  const initial = useMemo(newPost, [selected]);
  const {
    value: post,
    setValue,
    state,
    save,
  } = useDraft<Post>("post", selected, initial);
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        link: {
          openOnClick: false,
          HTMLAttributes: { rel: "noopener noreferrer" },
        },
      }),
      Image.configure({ allowBase64: false }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      TaskList,
      TaskItem.configure({ nested: true }),
    ],
    content: post.body
      ? DOMPurify.sanitize(marked.parse(post.body) as string)
      : "<p>Start writing…</p>",
    editorProps: {
      attributes: { class: "document-surface", "aria-label": "Post body" },
    },
    onUpdate: ({ editor }) =>
      setValue((p) => ({
        ...p,
        body: turndown.turndown(editor.getHTML()),
        excerpt:
          p.excerpt || excerptFromMarkdown(turndown.turndown(editor.getHTML())),
      })),
  });
  useEffect(() => {
    if (!editor || editor.isDestroyed || loadedPostId.current === post.id) return;
    loadedPostId.current = post.id;
    editor.commands.setContent(
      post.body
        ? DOMPurify.sanitize(marked.parse(post.body) as string)
        : "<p>Start writing…</p>",
      { emitUpdate: false },
    );
  }, [editor, post.id, post.body]);
  const setField = <K extends keyof Post>(key: K, value: Post[K]) =>
    setValue((current) => ({
      ...current,
      [key]: value,
      updatedAt: new Date().toISOString(),
    }));
  const publish = async () => {
    setPublishing(true);
    setMessage("");
    try {
      const valid = postSchema.parse({
        ...post,
        status: "published",
        slug: post.slug || slugify(post.title),
        excerpt: post.excerpt || excerptFromMarkdown(post.body),
      });
      const result = await draftsApi.publish("post", valid);
      setValue(valid);
      setMessage(
        `Published to GitHub. Site deployment is in progress. Version ${result.version.slice(0, 8)}.`,
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Publish failed.");
    } finally {
      setPublishing(false);
    }
  };
  const deleteDraft = async () => {
    if (!confirm(`Delete "${post.title || "this draft"}"?`)) return;
    await draftsApi.remove("post", selected);
    setSelected(crypto.randomUUID());
    setMessage("Draft deleted.");
  };
  const askLink = () => {
    const href = prompt("Link URL (https:// or mailto:)");
    if (href)
      editor?.chain().focus().extendMarkRange("link").setLink({ href }).run();
  };
  const uploadImage = async (file?: File) => {
    if (!file || !editor) return;
    const alt = prompt(
      "Describe this image for visitors using a screen reader.",
    );
    if (!alt) return;
    const slug = post.slug || slugify(post.title);
    if (!slug) {
      setMessage("Add a post title before uploading an image.");
      return;
    }
    try {
      const optimized = await optimizeImage(file);
      const form = new FormData();
      form.append("file", optimized);
      form.append("alt", alt);
      const result = await api<{ path: string; alt: string }>(
        `/api/publish/media/posts/${slug}`,
        { method: "POST", body: form },
      );
      editor
        .chain()
        .focus()
        .setImage({ src: result.path, alt: result.alt })
        .run();
      setMessage("Image published and inserted into this draft.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Image upload failed.",
      );
    }
  };
  return (
    <div className="editor-workspace">
      <input
        ref={imageRef}
        hidden
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        onChange={(event) => void uploadImage(event.target.files?.[0])}
      />
      <aside className="document-list">
        <header>
          <h2>Posts</h2>
          <Button
            appearance="primary"
            icon={<Add20Regular />}
            onClick={() => {
              setSelected(crypto.randomUUID());
              setPreview(false);
            }}
          >
            New
          </Button>
        </header>
        <div className="list-search">
          <Input placeholder="Search posts" aria-label="Search posts" />
        </div>
        <button className="document-row active">
          <span className="document-icon">W</span>
          <span>
            <strong>{post.title || "Untitled post"}</strong>
            <small>Draft · {post.publishedAt}</small>
          </span>
        </button>
        <button className="document-row">
          <span className="document-icon published">W</span>
          <span>
            <strong>Building a place for the work between projects</strong>
            <small>Published · Aug 31, 2026</small>
          </span>
        </button>
      </aside>
      <main className="post-editor">
        <header className="editor-titlebar">
          <div>
            <span className="breadcrumb">
              Posts / {post.title || "Untitled post"}
            </span>
            <SaveStatus state={state} />
          </div>
          <div>
            <Button
              icon={<Eye20Regular />}
              onClick={() => setPreview(!preview)}
            >
              {preview ? "Edit" : "Preview"}
            </Button>
            <Button
              appearance="primary"
              icon={<Send20Regular />}
              onClick={publish}
              disabled={publishing || !post.title}
            >
              {publishing ? "Publishing…" : "Publish"}
            </Button>
            <Button
              appearance="subtle"
              icon={<Delete20Regular />}
              onClick={deleteDraft}
              aria-label={`Delete ${post.title || "draft"}`}
            />
          </div>
        </header>
        <div className="metadata-strip">
          <Field label="Title" required>
            <Input
              size="large"
              value={post.title}
              onChange={(_, d) => {
                setField("title", d.value);
                if (!post.slug) setField("slug", slugify(d.value));
              }}
            />
          </Field>
          <div className="metadata-row">
            <Field label="Post date">
              <Input
                type="date"
                value={post.publishedAt.slice(0, 10)}
                onChange={(_, d) => setField("publishedAt", d.value)}
              />
            </Field>
            <Field label="Slug">
              <Input
                value={post.slug}
                onChange={(_, d) => setField("slug", slugify(d.value))}
              />
            </Field>
          </div>
          <Field label="Excerpt">
            <Textarea
              resize="vertical"
              value={post.excerpt}
              onChange={(_, d) => setField("excerpt", d.value)}
            />
          </Field>
        </div>
        {!preview && (
          <>
            <TabList className="ribbon-tabs" defaultSelectedValue="home">
              <Tab value="home">Home</Tab>
              <Tab value="insert">Insert</Tab>
            </TabList>
            <Toolbar className="editor-ribbon" aria-label="Document formatting">
              <div className="toolbar-group">
                <Tool
                  label="Undo (Ctrl+Z)"
                  icon={<ArrowUndo20Regular />}
                  onClick={() => editor?.chain().focus().undo().run()}
                  disabled={!editor?.can().undo()}
                />
                <Tool
                  label="Redo"
                  icon={<ArrowRedo20Regular />}
                  onClick={() => editor?.chain().focus().redo().run()}
                  disabled={!editor?.can().redo()}
                />
                <span>History</span>
              </div>
              <div className="toolbar-group">
                <select
                  aria-label="Paragraph style"
                  onChange={(e) => {
                    const v = e.target.value;
                    v === "p"
                      ? editor?.chain().focus().setParagraph().run()
                      : editor
                          ?.chain()
                          .focus()
                          .toggleHeading({ level: +v as 1 | 2 | 3 })
                          .run();
                  }}
                >
                  <option value="p">Paragraph</option>
                  <option value="1">Heading 1</option>
                  <option value="2">Heading 2</option>
                  <option value="3">Heading 3</option>
                </select>
                <span>Styles</span>
              </div>
              <div className="toolbar-group">
                <Tool
                  label="Bold (Ctrl+B)"
                  icon={<TextBold20Regular />}
                  active={editor?.isActive("bold")}
                  onClick={() => editor?.chain().focus().toggleBold().run()}
                />
                <Tool
                  label="Italic (Ctrl+I)"
                  icon={<TextItalic20Regular />}
                  active={editor?.isActive("italic")}
                  onClick={() => editor?.chain().focus().toggleItalic().run()}
                />
                <Tool
                  label="Underline"
                  icon={<TextUnderline20Regular />}
                  active={editor?.isActive("underline")}
                  onClick={() =>
                    editor?.chain().focus().toggleUnderline().run()
                  }
                />
                <Tool
                  label="Strikethrough"
                  icon={<TextStrikethrough20Regular />}
                  active={editor?.isActive("strike")}
                  onClick={() => editor?.chain().focus().toggleStrike().run()}
                />
                <span>Text</span>
              </div>
              <div className="toolbar-group">
                <Tool
                  label="Bulleted list"
                  icon={<TextBulletListLtr20Regular />}
                  onClick={() =>
                    editor?.chain().focus().toggleBulletList().run()
                  }
                />
                <Tool
                  label="Numbered list"
                  icon={<TextNumberListLtr20Regular />}
                  onClick={() =>
                    editor?.chain().focus().toggleOrderedList().run()
                  }
                />
                <Tool
                  label="Checklist"
                  icon={<TextBulletListSquare20Regular />}
                  onClick={() => editor?.chain().focus().toggleTaskList().run()}
                />
                <Tool
                  label="Code block"
                  icon={<Code20Regular />}
                  onClick={() =>
                    editor?.chain().focus().toggleCodeBlock().run()
                  }
                />
                <Tool
                  label="Align left"
                  icon={<TextAlignLeft20Regular />}
                  onClick={() => editor?.chain().focus().setTextAlign("left").run()}
                />
                <Tool
                  label="Align center"
                  icon={<TextAlignCenter20Regular />}
                  onClick={() => editor?.chain().focus().setTextAlign("center").run()}
                />
                <Tool
                  label="Align right"
                  icon={<TextAlignRight20Regular />}
                  onClick={() => editor?.chain().focus().setTextAlign("right").run()}
                />
                <span>Paragraph</span>
              </div>
              <div className="toolbar-group">
                <Tool label="Link" icon={<Link20Regular />} onClick={askLink} />
                <Tool
                  label="Image"
                  icon={<Image20Regular />}
                  onClick={() => imageRef.current?.click()}
                />
                <Tool
                  label="Table"
                  icon={<Table20Regular />}
                  onClick={() =>
                    editor
                      ?.chain()
                      .focus()
                      .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
                      .run()
                  }
                />
                <span>Insert</span>
              </div>
              <div className="toolbar-group">
                <Tool
                  label="Save draft (Ctrl+S)"
                  icon={<Save20Regular />}
                  onClick={() => void save()}
                />
                <Tool
                  label="Clear formatting"
                  icon={<Dismiss20Regular />}
                  onClick={() =>
                    editor?.chain().focus().unsetAllMarks().clearNodes().run()
                  }
                />
                <span>Document</span>
              </div>
            </Toolbar>
            <div className="document-canvas">
              <EditorContent editor={editor} />
            </div>
          </>
        )}
        {preview && (
          <div className="preview-canvas">
            <article>
              <p className="preview-date">{post.publishedAt}</p>
              <h1>{post.title || "Untitled post"}</h1>
              <p className="preview-dek">{post.excerpt}</p>
              <div
                className="preview-prose"
                dangerouslySetInnerHTML={{
                  __html: DOMPurify.sanitize(editor?.getHTML() || ""),
                }}
              />
            </article>
          </div>
        )}
        {message && (
          <div
            className={
              message.startsWith("Published")
                ? "publish-message"
                : "publish-message error"
            }
            role="status"
          >
            {message}
          </div>
        )}
      </main>
    </div>
  );
}
