import { useEffect, useMemo, useRef, useState } from "react";
import {
  Button,
  Field,
  Input,
  Textarea,
  Toolbar,
  ToolbarButton,
  Tooltip,
} from "@fluentui/react-components";
import {
  ArrowUndo20Regular,
  ArrowRedo20Regular,
  ClipboardPaste20Regular,
  Copy20Regular,
  Cut20Regular,
  PaintBrush20Regular,
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
  TextAlignJustify20Regular,
  TextIndentIncrease20Regular,
  TextIndentDecrease20Regular,
  TextQuote20Regular,
  TextSubscript20Regular,
  TextSuperscript20Regular,
  FontIncrease20Regular,
  FontDecrease20Regular,
  Highlight20Regular,
  TextColor20Regular,
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
  LineHorizontal120Regular,
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
import { TextStyleKit } from "@tiptap/extension-text-style";
import Highlight from "@tiptap/extension-highlight";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
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
import { api, draftsApi, publishedApi, type PublishedItem } from "../api";
import { optimizeImage } from "../media";
import { SaveStatus } from "./SaveStatus";

const PUBLIC_SITE_URL = "https://brendonbusker.github.io";
const FONT_SIZES = [10, 11, 12, 14, 16, 18, 24, 32, 48];
const IMAGE_LAYOUTS = [
  "inline",
  "block",
  "full",
  "left",
  "right",
  "behind",
  "front",
] as const;
type ImageLayout = (typeof IMAGE_LAYOUTS)[number];

function imageLayout(value: unknown): ImageLayout {
  return IMAGE_LAYOUTS.includes(value as ImageLayout)
    ? (value as ImageLayout)
    : "block";
}

const CmsImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      cmsPath: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-cms-path"),
        renderHTML: (attributes) =>
          attributes.cmsPath
            ? { "data-cms-path": String(attributes.cmsPath) }
            : {},
      },
      layout: {
        default: "block",
        parseHTML: (element) =>
          imageLayout(element.getAttribute("data-layout")),
        renderHTML: (attributes) => ({
          "data-layout": imageLayout(attributes.layout),
        }),
      },
    };
  },
});

function publicAssetUrl(src: string) {
  if (!src.startsWith("/")) return src;
  return new URL(src, PUBLIC_SITE_URL).href;
}

function bodyToEditorHtml(body: string) {
  const html = /^\s*</.test(body) ? body : (marked.parse(body) as string);
  const document = new DOMParser().parseFromString(
    DOMPurify.sanitize(html),
    "text/html",
  );
  document.querySelectorAll("img").forEach((image) => {
    const src = image.getAttribute("src");
    if (src) image.setAttribute("src", publicAssetUrl(src));
  });
  return document.body.innerHTML;
}

function editorHtmlForStorage(html: string) {
  const document = new DOMParser().parseFromString(
    DOMPurify.sanitize(html),
    "text/html",
  );
  document.querySelectorAll("img").forEach((image) => {
    const cmsPath = image.getAttribute("data-cms-path");
    const src = image.getAttribute("src") || "";
    if (cmsPath) image.setAttribute("src", cmsPath);
    else if (src.startsWith(`${PUBLIC_SITE_URL}/`))
      image.setAttribute("src", new URL(src).pathname);
    image.removeAttribute("data-cms-path");
  });
  return DOMPurify.sanitize(document.body.innerHTML);
}
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
  const firstPost = useMemo(newPost, []);
  const [selected, setSelected] = useState(firstPost.id);
  const [scratchPosts, setScratchPosts] = useState<Record<string, Post>>({
    [firstPost.id]: firstPost,
  });
  const [publishedPosts, setPublishedPosts] = useState<
    Array<PublishedItem<Post>>
  >([]);
  const [draftPosts, setDraftPosts] = useState<
    Array<{ key: string; post: Post; updatedAt: string }>
  >([]);
  const [syncing, setSyncing] = useState(true);
  const [search, setSearch] = useState("");
  const [preview, setPreview] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState("");
  const imageRef = useRef<HTMLInputElement>(null);
  const loadedRevision = useRef(-1);
  const objectUrls = useRef<string[]>([]);
  const formatBrush = useRef<Record<string, unknown> | null>(null);
  const initial = useMemo(
    () =>
      draftPosts.find(({ key }) => key === selected)?.post ??
      publishedPosts.find(({ content }) => content.id === selected)?.content ??
      scratchPosts[selected] ??
      newPost(),
    [draftPosts, publishedPosts, scratchPosts, selected],
  );
  const sourceVersion =
    publishedPosts.find(({ content }) => content.id === selected)?.sha ??
    draftPosts.find(({ key }) => key === selected)?.updatedAt ??
    "";
  const {
    value: post,
    setValue,
    state,
    save,
    reset,
    loading,
    revision,
  } = useDraft<Post>("post", selected, initial, sourceVersion);
  useEffect(() => {
    let alive = true;
    Promise.all([publishedApi.collection<Post>("posts"), draftsApi.list()])
      .then(([{ items }, { drafts }]) => {
        if (!alive) return;
        setPublishedPosts(items);
        setDraftPosts(
          drafts
            .filter(({ content_type }) => content_type === "post")
            .flatMap(({ content_key, payload_json, updated_at }) => {
              try {
                const value = JSON.parse(payload_json) as Post;
                return value && typeof value.id === "string"
                  ? [{ key: content_key, post: value, updatedAt: updated_at }]
                  : [];
              } catch {
                return [];
              }
            }),
        );
      })
      .catch((error) =>
        setMessage(
          error instanceof Error
            ? error.message
            : "Could not load posts from GitHub.",
        ),
      )
      .finally(() => {
        if (alive) setSyncing(false);
      });
    return () => {
      alive = false;
    };
  }, []);
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        link: {
          openOnClick: false,
          HTMLAttributes: { rel: "noopener noreferrer" },
        },
      }),
      CmsImage.configure({
        allowBase64: false,
        resize: {
          enabled: true,
          directions: [
            "left",
            "right",
            "top-left",
            "top-right",
            "bottom-left",
            "bottom-right",
          ],
          minWidth: 120,
          minHeight: 80,
          alwaysPreserveAspectRatio: true,
        },
      }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      TaskList,
      TaskItem.configure({ nested: true }),
      TextStyleKit,
      Highlight.configure({ multicolor: true }),
      Subscript,
      Superscript,
    ],
    content: post.body ? bodyToEditorHtml(post.body) : "<p>Start writing…</p>",
    editorProps: {
      attributes: { class: "document-surface", "aria-label": "Post body" },
    },
    onUpdate: ({ editor }) => {
      const body = editorHtmlForStorage(editor.getHTML());
      setValue((p) => ({
        ...p,
        body,
        excerpt: p.excerpt || excerptFromMarkdown(body),
        updatedAt: new Date().toISOString(),
      }));
    },
  });
  useEffect(() => {
    if (!editor || editor.isDestroyed || loadedRevision.current === revision)
      return;
    loadedRevision.current = revision;
    editor.commands.setContent(
      post.body ? bodyToEditorHtml(post.body) : "<p>Start writing…</p>",
      { emitUpdate: false },
    );
  }, [editor, post.body, revision]);
  useEffect(
    () => () => objectUrls.current.forEach((url) => URL.revokeObjectURL(url)),
    [],
  );
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
      const source = publishedPosts.find(
        ({ content }) => content.id === valid.id,
      );
      const result = await draftsApi.publish("post", valid, {
        expectedSha: source?.sha || undefined,
        targetPath: source?.path || undefined,
      });
      await draftsApi.remove("post", selected);
      const nextItem = {
        content: valid,
        path: result.path,
        sha: result.contentSha,
      };
      setPublishedPosts((items) =>
        source
          ? items.map((item) => (item === source ? nextItem : item))
          : [nextItem, ...items],
      );
      setDraftPosts((items) => items.filter(({ key }) => key !== selected));
      reset(valid);
      setMessage(
        `Published to GitHub. Site deployment is in progress. Version ${result.version.slice(0, 8)}.`,
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Publish failed.");
    } finally {
      setPublishing(false);
    }
  };
  const deletePost = async () => {
    const source = publishedPosts.find(({ content }) => content.id === post.id);
    const promptText = source
      ? `Permanently delete the published post "${post.title}"? It will be removed from the public Blog after the next deployment, and this cannot be undone from the admin.`
      : `Delete the draft "${post.title || "Untitled post"}"?`;
    if (!confirm(promptText)) return;
    setDeleting(true);
    setMessage("");
    try {
      if (source) {
        const result = await publishedApi.removePost({
          path: source.path,
          expectedSha: source.sha,
          contentKey: selected,
          title: post.title,
        });
        setPublishedPosts((items) => items.filter((item) => item !== source));
        setDraftPosts((items) => items.filter(({ key }) => key !== selected));
        const next = newPost();
        setScratchPosts((items) => ({ ...items, [next.id]: next }));
        setSelected(next.id);
        setPreview(false);
        setMessage(
          `Published post deleted. Site deployment is in progress. Version ${result.version.slice(0, 8)}.`,
        );
        return;
      }
      await draftsApi.remove("post", selected);
      setDraftPosts((items) => items.filter(({ key }) => key !== selected));
      const next = newPost();
      setScratchPosts((items) => ({ ...items, [next.id]: next }));
      setSelected(next.id);
      setPreview(false);
      setMessage("Draft deleted. A new blank post is ready.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Post deletion failed.",
      );
    } finally {
      setDeleting(false);
    }
  };
  const listEntries = useMemo(() => {
    const entries: Array<{
      key: string;
      content: Post;
      status: "Draft" | "Published";
      date: string;
    }> = draftPosts.map(({ key, post: content, updatedAt }) => ({
      key,
      content: key === selected ? post : content,
      status: "Draft",
      date: updatedAt.slice(0, 10),
    }));
    for (const item of publishedPosts) {
      if (!draftPosts.some(({ post: draft }) => draft.id === item.content.id))
        entries.push({
          key: item.content.id,
          content: item.content,
          status: "Published" as const,
          date: item.content.publishedAt.slice(0, 10),
        });
    }
    if (!entries.some(({ key }) => key === selected))
      entries.unshift({
        key: selected,
        content: post,
        status: "Draft" as const,
        date: post.publishedAt.slice(0, 10),
      });
    const query = search.trim().toLowerCase();
    return query
      ? entries.filter(({ content }) =>
          `${content.title} ${content.excerpt}`.toLowerCase().includes(query),
        )
      : entries;
  }, [draftPosts, post, publishedPosts, search, selected]);
  const askLink = () => {
    const href = prompt("Link URL (https:// or mailto:)");
    if (href)
      editor?.chain().focus().extendMarkRange("link").setLink({ href }).run();
  };
  const copySelection = async (cut = false) => {
    if (!editor) return;
    const { from, to, empty } = editor.state.selection;
    if (empty) {
      setMessage("Select some text before using Copy or Cut.");
      return;
    }
    const text = editor.state.doc.textBetween(from, to, "\n");
    try {
      await navigator.clipboard.writeText(text);
      if (cut) editor.chain().focus().deleteSelection().run();
      setMessage(cut ? "Selection cut to the clipboard." : "Selection copied.");
    } catch {
      setMessage(
        "Clipboard access is unavailable. Use Ctrl+C or Ctrl+X instead.",
      );
    }
  };
  const pasteText = async () => {
    if (!editor) return;
    try {
      const text = await navigator.clipboard.readText();
      editor.chain().focus().insertContent(text).run();
      setMessage("Clipboard text pasted.");
    } catch {
      setMessage("Clipboard access is unavailable. Use Ctrl+V instead.");
    }
  };
  const useFormatBrush = () => {
    if (!editor) return;
    if (!formatBrush.current) {
      formatBrush.current = {
        textStyle: editor.getAttributes("textStyle"),
        bold: editor.isActive("bold"),
        italic: editor.isActive("italic"),
        underline: editor.isActive("underline"),
        strike: editor.isActive("strike"),
        subscript: editor.isActive("subscript"),
        superscript: editor.isActive("superscript"),
        highlight: editor.getAttributes("highlight"),
      };
      setMessage(
        "Formatting copied. Select the destination text, then click Format painter again.",
      );
      return;
    }
    const format = formatBrush.current;
    editor.commands.unsetAllMarks();
    const textStyle = format.textStyle as Record<string, string>;
    if (Object.values(textStyle).some(Boolean))
      editor.commands.setMark("textStyle", textStyle);
    if (format.bold) editor.commands.setBold();
    if (format.italic) editor.commands.setItalic();
    if (format.underline) editor.commands.setUnderline();
    if (format.strike) editor.commands.setStrike();
    if (format.subscript) editor.commands.setSubscript();
    if (format.superscript) editor.commands.setSuperscript();
    const highlight = format.highlight as { color?: string };
    if (highlight.color)
      editor.commands.setHighlight({ color: highlight.color });
    editor.commands.focus();
    formatBrush.current = null;
    setMessage("Formatting applied.");
  };
  const changeCase = (kind: string) => {
    if (!editor || !kind) return;
    const { from, to, empty } = editor.state.selection;
    if (empty) {
      setMessage("Select text before changing its case.");
      return;
    }
    const source = editor.state.doc.textBetween(from, to, " ");
    const changed =
      kind === "upper"
        ? source.toUpperCase()
        : kind === "lower"
          ? source.toLowerCase()
          : source.replace(/\b\p{L}/gu, (letter) => letter.toUpperCase());
    editor.chain().focus().insertContentAt({ from, to }, changed).run();
  };
  const resizeText = (direction: 1 | -1) => {
    if (!editor) return;
    const current = Number.parseInt(
      editor.getAttributes("textStyle").fontSize || "16",
      10,
    );
    const currentIndex = FONT_SIZES.reduce(
      (best, size, index) =>
        Math.abs(size - current) < Math.abs(FONT_SIZES[best]! - current)
          ? index
          : best,
      0,
    );
    const next =
      FONT_SIZES[
        Math.max(0, Math.min(FONT_SIZES.length - 1, currentIndex + direction))
      ];
    editor.chain().focus().setFontSize(`${next}px`).run();
  };
  const indentList = (direction: 1 | -1) => {
    if (!editor) return;
    const item = editor.isActive("taskItem") ? "taskItem" : "listItem";
    if (direction > 0) editor.chain().focus().sinkListItem(item).run();
    else editor.chain().focus().liftListItem(item).run();
  };
  const choosePost = async (key: string) => {
    if (key === selected) return;
    if (state === "unsaved" || state === "saving") await save();
    setSelected(key);
    setPreview(false);
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
      const previewUrl = URL.createObjectURL(optimized);
      objectUrls.current.push(previewUrl);
      editor
        .chain()
        .focus()
        .setImage({
          src: previewUrl,
          alt: result.alt,
          cmsPath: result.path,
          layout: "block",
        } as Parameters<typeof editor.commands.setImage>[0])
        .run();
      setMessage(
        "Image inserted. Drag it to move it, or select it and use the resize handles.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Image upload failed.",
      );
    } finally {
      if (imageRef.current) imageRef.current.value = "";
    }
  };
  const selectedImageLayout = editor?.isActive("image")
    ? imageLayout(editor.getAttributes("image").layout)
    : "block";
  const setSelectedImageLayout = (layout: ImageLayout) => {
    if (!editor?.isActive("image")) return;
    editor.chain().focus().updateAttributes("image", { layout }).run();
    setMessage(`Image layout changed to ${layout.replace("-", " ")}.`);
  };
  const editImageAltText = () => {
    if (!editor?.isActive("image")) return;
    const current = String(editor.getAttributes("image").alt || "");
    const alt = prompt(
      "Describe this image for visitors using a screen reader.",
      current,
    );
    if (alt === null) return;
    editor.chain().focus().updateAttributes("image", { alt }).run();
    setMessage("Image description updated.");
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
          <h2>Blog</h2>
          <Button
            appearance="primary"
            icon={<Add20Regular />}
            onClick={() => {
              void (async () => {
                if (state === "unsaved" || state === "saving") await save();
                const next = newPost();
                setScratchPosts((items) => ({ ...items, [next.id]: next }));
                setSelected(next.id);
                setPreview(false);
              })();
            }}
          >
            New
          </Button>
        </header>
        <div className="list-search">
          <Input
            placeholder="Search blog posts"
            aria-label="Search blog posts"
            value={search}
            onChange={(_, data) => setSearch(data.value)}
          />
        </div>
        {syncing && <p className="list-status">Loading blog posts…</p>}
        {!syncing && listEntries.length === 0 && (
          <p className="list-status">No posts match this search.</p>
        )}
        {listEntries.map((entry) => (
          <button
            key={entry.key}
            className={`document-row ${entry.key === selected ? "active" : ""}`}
            onClick={() => void choosePost(entry.key)}
          >
            <span
              className={`document-icon ${entry.status === "Published" ? "published" : ""}`}
            >
              W
            </span>
            <span>
              <strong>{entry.content.title || "Untitled post"}</strong>
              <small>
                {entry.status} · {entry.date}
              </small>
            </span>
          </button>
        ))}
      </aside>
      <main className="post-editor">
        <header className="editor-titlebar">
          <div>
            <span className="breadcrumb">
              Blog / {post.title || "Untitled post"}
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
              disabled={
                publishing || deleting || syncing || loading || !post.title
              }
            >
              {publishing ? "Publishing…" : "Publish"}
            </Button>
            <Tooltip
              content={
                publishedPosts.some(({ content }) => content.id === post.id)
                  ? "Delete published post"
                  : "Delete draft"
              }
              relationship="label"
            >
              <Button
                appearance="subtle"
                icon={<Delete20Regular />}
                onClick={deletePost}
                disabled={deleting || syncing || loading}
                aria-label={
                  publishedPosts.some(({ content }) => content.id === post.id)
                    ? `Delete published post ${post.title}`
                    : `Delete draft ${post.title || "Untitled post"}`
                }
              />
            </Tooltip>
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
            <Toolbar className="editor-ribbon" aria-label="Document formatting">
              <div className="toolbar-group">
                <Tool
                  label="Undo (Ctrl+Z)"
                  icon={<ArrowUndo20Regular />}
                  onClick={() => editor?.chain().focus().undo().run()}
                  disabled={!editor?.can().undo()}
                />
                <Tool
                  label="Redo (Ctrl+Y)"
                  icon={<ArrowRedo20Regular />}
                  onClick={() => editor?.chain().focus().redo().run()}
                  disabled={!editor?.can().redo()}
                />
                <span>History</span>
              </div>
              <div className="toolbar-group toolbar-group-wide">
                <div className="ribbon-control-stack clipboard-tools">
                  <Tool
                    label="Paste"
                    icon={<ClipboardPaste20Regular />}
                    onClick={() => void pasteText()}
                  />
                  <Tool
                    label="Cut"
                    icon={<Cut20Regular />}
                    onClick={() => void copySelection(true)}
                  />
                  <Tool
                    label="Copy"
                    icon={<Copy20Regular />}
                    onClick={() => void copySelection()}
                  />
                  <Tool
                    label="Format painter"
                    icon={<PaintBrush20Regular />}
                    active={Boolean(formatBrush.current)}
                    onClick={useFormatBrush}
                  />
                </div>
                <span>Clipboard</span>
              </div>
              <div className="toolbar-group font-group">
                <div className="ribbon-control-stack">
                  <div className="ribbon-row">
                    <select
                      aria-label="Font family"
                      defaultValue=""
                      onChange={(event) =>
                        event.target.value
                          ? editor
                              ?.chain()
                              .focus()
                              .setFontFamily(event.target.value)
                              .run()
                          : editor?.chain().focus().unsetFontFamily().run()
                      }
                    >
                      <option value="">Theme font</option>
                      <option value="Arial">Arial</option>
                      <option value="Georgia">Georgia</option>
                      <option value="Segoe UI">Segoe UI</option>
                      <option value="Times New Roman">Times New Roman</option>
                      <option value="Courier New">Courier New</option>
                    </select>
                    <select
                      className="font-size-select"
                      aria-label="Font size"
                      defaultValue="16"
                      onChange={(event) =>
                        editor
                          ?.chain()
                          .focus()
                          .setFontSize(`${event.target.value}px`)
                          .run()
                      }
                    >
                      {FONT_SIZES.map((size) => (
                        <option key={size} value={size}>
                          {size}
                        </option>
                      ))}
                    </select>
                    <Tool
                      label="Increase font size"
                      icon={<FontIncrease20Regular />}
                      onClick={() => resizeText(1)}
                    />
                    <Tool
                      label="Decrease font size"
                      icon={<FontDecrease20Regular />}
                      onClick={() => resizeText(-1)}
                    />
                    <select
                      className="case-select"
                      aria-label="Change case"
                      defaultValue=""
                      onChange={(event) => {
                        changeCase(event.target.value);
                        event.target.value = "";
                      }}
                    >
                      <option value="">Aa</option>
                      <option value="title">Capitalize Each Word</option>
                      <option value="upper">UPPERCASE</option>
                      <option value="lower">lowercase</option>
                    </select>
                  </div>
                  <div className="ribbon-row">
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
                      onClick={() =>
                        editor?.chain().focus().toggleItalic().run()
                      }
                    />
                    <Tool
                      label="Underline (Ctrl+U)"
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
                      onClick={() =>
                        editor?.chain().focus().toggleStrike().run()
                      }
                    />
                    <Tool
                      label="Subscript"
                      icon={<TextSubscript20Regular />}
                      active={editor?.isActive("subscript")}
                      onClick={() =>
                        editor?.chain().focus().toggleSubscript().run()
                      }
                    />
                    <Tool
                      label="Superscript"
                      icon={<TextSuperscript20Regular />}
                      active={editor?.isActive("superscript")}
                      onClick={() =>
                        editor?.chain().focus().toggleSuperscript().run()
                      }
                    />
                    <label
                      className="color-tool"
                      title="Text color"
                      aria-label="Text color"
                    >
                      <TextColor20Regular />
                      <input
                        type="color"
                        defaultValue="#111111"
                        onChange={(event) =>
                          editor
                            ?.chain()
                            .focus()
                            .setColor(event.target.value)
                            .run()
                        }
                      />
                    </label>
                    <label
                      className="color-tool"
                      title="Text highlight"
                      aria-label="Text highlight"
                    >
                      <Highlight20Regular />
                      <input
                        type="color"
                        defaultValue="#fff2a8"
                        onChange={(event) =>
                          editor
                            ?.chain()
                            .focus()
                            .setHighlight({ color: event.target.value })
                            .run()
                        }
                      />
                    </label>
                    <Tool
                      label="Clear formatting"
                      icon={<Dismiss20Regular />}
                      onClick={() =>
                        editor?.chain().focus().unsetAllMarks().run()
                      }
                    />
                  </div>
                </div>
                <span>Font</span>
              </div>
              <div className="toolbar-group paragraph-group">
                <div className="ribbon-control-stack">
                  <div className="ribbon-row">
                    <Tool
                      label="Bulleted list"
                      icon={<TextBulletListLtr20Regular />}
                      active={editor?.isActive("bulletList")}
                      onClick={() =>
                        editor?.chain().focus().toggleBulletList().run()
                      }
                    />
                    <Tool
                      label="Numbered list"
                      icon={<TextNumberListLtr20Regular />}
                      active={editor?.isActive("orderedList")}
                      onClick={() =>
                        editor?.chain().focus().toggleOrderedList().run()
                      }
                    />
                    <Tool
                      label="Checklist"
                      icon={<TextBulletListSquare20Regular />}
                      active={editor?.isActive("taskList")}
                      onClick={() =>
                        editor?.chain().focus().toggleTaskList().run()
                      }
                    />
                    <Tool
                      label="Decrease indent"
                      icon={<TextIndentDecrease20Regular />}
                      onClick={() => indentList(-1)}
                      disabled={
                        !editor?.isActive("listItem") &&
                        !editor?.isActive("taskItem")
                      }
                    />
                    <Tool
                      label="Increase indent"
                      icon={<TextIndentIncrease20Regular />}
                      onClick={() => indentList(1)}
                      disabled={
                        !editor?.isActive("listItem") &&
                        !editor?.isActive("taskItem")
                      }
                    />
                    <select
                      aria-label="Paragraph style"
                      defaultValue="p"
                      onChange={(event) => {
                        const value = event.target.value;
                        value === "p"
                          ? editor?.chain().focus().setParagraph().run()
                          : editor
                              ?.chain()
                              .focus()
                              .setHeading({ level: +value as 1 | 2 | 3 })
                              .run();
                      }}
                    >
                      <option value="p">Paragraph</option>
                      <option value="1">Heading 1</option>
                      <option value="2">Heading 2</option>
                      <option value="3">Heading 3</option>
                    </select>
                  </div>
                  <div className="ribbon-row">
                    <Tool
                      label="Align left"
                      icon={<TextAlignLeft20Regular />}
                      active={editor?.isActive({ textAlign: "left" })}
                      onClick={() =>
                        editor?.chain().focus().setTextAlign("left").run()
                      }
                    />
                    <Tool
                      label="Align center"
                      icon={<TextAlignCenter20Regular />}
                      active={editor?.isActive({ textAlign: "center" })}
                      onClick={() =>
                        editor?.chain().focus().setTextAlign("center").run()
                      }
                    />
                    <Tool
                      label="Align right"
                      icon={<TextAlignRight20Regular />}
                      active={editor?.isActive({ textAlign: "right" })}
                      onClick={() =>
                        editor?.chain().focus().setTextAlign("right").run()
                      }
                    />
                    <Tool
                      label="Justify"
                      icon={<TextAlignJustify20Regular />}
                      active={editor?.isActive({ textAlign: "justify" })}
                      onClick={() =>
                        editor?.chain().focus().setTextAlign("justify").run()
                      }
                    />
                    <Tool
                      label="Block quote"
                      icon={<TextQuote20Regular />}
                      active={editor?.isActive("blockquote")}
                      onClick={() =>
                        editor?.chain().focus().toggleBlockquote().run()
                      }
                    />
                    <Tool
                      label="Code block"
                      icon={<Code20Regular />}
                      active={editor?.isActive("codeBlock")}
                      onClick={() =>
                        editor?.chain().focus().toggleCodeBlock().run()
                      }
                    />
                    <select
                      aria-label="Line spacing"
                      defaultValue=""
                      onChange={(event) =>
                        event.target.value
                          ? editor
                              ?.chain()
                              .focus()
                              .setLineHeight(event.target.value)
                              .run()
                          : editor?.chain().focus().unsetLineHeight().run()
                      }
                    >
                      <option value="">Line spacing</option>
                      <option value="1">1.0</option>
                      <option value="1.15">1.15</option>
                      <option value="1.5">1.5</option>
                      <option value="2">2.0</option>
                    </select>
                  </div>
                </div>
                <span>Paragraph</span>
              </div>
              <div className="toolbar-group toolbar-group-wide insert-group">
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
                      .insertTable({
                        rows: 3,
                        cols: 3,
                        withHeaderRow: true,
                      })
                      .run()
                  }
                />
                <Tool
                  label="Horizontal line"
                  icon={<LineHorizontal120Regular />}
                  onClick={() =>
                    editor?.chain().focus().setHorizontalRule().run()
                  }
                />
                <span>Insert</span>
              </div>
              <div className="toolbar-group image-layout-group">
                <div className="ribbon-control-stack">
                  <select
                    aria-label="Image text wrapping"
                    value={selectedImageLayout}
                    disabled={!editor?.isActive("image")}
                    onChange={(event) =>
                      setSelectedImageLayout(event.target.value as ImageLayout)
                    }
                  >
                    <option value="inline">In line with text</option>
                    <option value="block">Top and bottom</option>
                    <option value="left">Square — left</option>
                    <option value="right">Square — right</option>
                    <option value="behind">Behind text</option>
                    <option value="front">In front of text</option>
                    <option value="full">Full width</option>
                  </select>
                  <div className="ribbon-row">
                    <Tool
                      label="Edit image description"
                      icon={<Image20Regular />}
                      onClick={editImageAltText}
                      disabled={!editor?.isActive("image")}
                    />
                    <Tool
                      label="Remove selected image"
                      icon={<Delete20Regular />}
                      onClick={() =>
                        editor?.chain().focus().deleteSelection().run()
                      }
                      disabled={!editor?.isActive("image")}
                    />
                  </div>
                </div>
                <span>Image layout</span>
              </div>
              <div className="toolbar-group">
                <Tool
                  label="Save draft (Ctrl+S)"
                  icon={<Save20Regular />}
                  onClick={() => void save()}
                />
                <Tool
                  label="Clear document formatting"
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
              /failed|could not|unavailable|required|add a post title/i.test(
                message,
              )
                ? "publish-message error"
                : "publish-message"
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
