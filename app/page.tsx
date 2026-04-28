"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ExternalLink,
  ImagePlus,
  LogIn,
  LogOut,
  Pencil,
  Plus,
  Save,
  Search,
  Settings,
  Trash2,
  X,
} from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { ADMIN_EMAIL, LAB_URL, hasSupabaseEnv, supabase } from "@/lib/supabase";
import type { HglMember, HglTool, ToolType } from "@/lib/types";

type ToolDraft = {
  name: string;
  url: string;
  description: string;
  type: ToolType;
  logoFile: File | null;
  logoPreview: string | null;
};

const emptyDraft: ToolDraft = {
  name: "",
  url: "",
  description: "",
  type: "public",
  logoFile: null,
  logoPreview: null,
};

const seededTools: HglTool[] = [
  {
    id: "seed-1",
    name: "Gene Panel Browser",
    url: "https://hglab.hcmus.edu.vn",
    description: "Browse curated human genetics panels and annotations.",
    updated_on: "2026-04-22",
    type: "public",
    logo_url: null,
    created_at: "2026-04-22T00:00:00Z",
  },
  {
    id: "seed-2",
    name: "Variant Workbench",
    url: "https://hglab.hcmus.edu.vn",
    description: "Internal variant triage workspace for HGL members.",
    updated_on: "2026-04-18",
    type: "private",
    logo_url: null,
    created_at: "2026-04-18T00:00:00Z",
  },
  {
    id: "seed-3",
    name: "Primer Toolkit",
    url: "https://hglab.hcmus.edu.vn",
    description: "Small utilities for primer checks and sequence preparation.",
    updated_on: "2026-04-11",
    type: "public",
    logo_url: null,
    created_at: "2026-04-11T00:00:00Z",
  },
];

function LabLogo({ compact = false }: { compact?: boolean }) {
  return (
    <a
      aria-label="Open HGLab website"
      className={compact ? "lab-logo compact" : "lab-logo"}
      href={LAB_URL}
    >
      <img alt="Human Genetics Laboratory logo" src="/hgl-logo-blue.png" />
    </a>
  );
}

function ToolLogo({ tool }: { tool: HglTool }) {
  if (tool.logo_url) {
    return <img alt={`${tool.name} logo`} className="tool-logo" src={tool.logo_url} />;
  }

  return (
    <div className="tool-logo generated" aria-hidden="true">
      {tool.name.slice(0, 2).toUpperCase()}
    </div>
  );
}

function TypePill({ type }: { type: ToolType }) {
  return <span className={`type-pill ${type}`}>{type === "public" ? "Public" : "Private"}</span>;
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function getFileFromClipboard(event: ClipboardEvent) {
  const items = event.clipboardData?.items;
  if (!items) return null;

  for (const item of Array.from(items)) {
    if (item.type.startsWith("image/")) {
      return item.getAsFile();
    }
  }

  return null;
}

function recentStorageKey(email: string) {
  return `hgltools:recent:${email || "anonymous"}`;
}

function readLocalRecent(email: string): HglTool[] {
  if (typeof window === "undefined") return [];

  try {
    const value = window.localStorage.getItem(recentStorageKey(email));
    if (!value) return [];
    return JSON.parse(value) as HglTool[];
  } catch {
    return [];
  }
}

function writeLocalRecent(email: string, tools: HglTool[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(recentStorageKey(email), JSON.stringify(tools.slice(0, 5)));
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [isMember, setIsMember] = useState(false);
  const [tools, setTools] = useState<HglTool[]>(seededTools);
  const [recentTools, setRecentTools] = useState<HglTool[]>([]);
  const [members, setMembers] = useState<HglMember[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [activeModal, setActiveModal] = useState<"add" | "edit" | "manage" | null>(null);
  const [editingTool, setEditingTool] = useState<HglTool | null>(null);
  const [draft, setDraft] = useState<ToolDraft>(emptyDraft);
  const [memberEmail, setMemberEmail] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const email = user?.email?.toLowerCase() ?? "";
  const isAdmin = email === ADMIN_EMAIL;
  const canSeePrivate = isAdmin || isMember;

  const visibleTools = useMemo(() => {
    return tools
      .filter((tool) => canSeePrivate || tool.type === "public")
      .filter((tool) => {
        const query = search.trim().toLowerCase();
        if (!query) return true;
        return [tool.name, tool.description, tool.type, tool.updated_on].some((value) =>
          value.toLowerCase().includes(query),
        );
      })
      .sort((a, b) => b.updated_on.localeCompare(a.updated_on));
  }, [canSeePrivate, search, tools]);

  const filteredRecentTools = useMemo(() => {
    const visibleIds = new Set(visibleTools.map((tool) => tool.id));
    return recentTools.filter((tool) => visibleIds.has(tool.id));
  }, [recentTools, visibleTools]);

  const loadTools = useCallback(async () => {
    if (!supabase) {
      setTools(seededTools);
      setRecentTools([]);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("tools")
      .select("*")
      .order("updated_on", { ascending: false });

    if (error) {
      setMessage(error.message);
    } else {
      setTools((data as HglTool[]) ?? []);
    }
    setLoading(false);
  }, []);

  const loadRecent = useCallback(async (currentUser: User | null) => {
    const currentEmail = currentUser?.email?.toLowerCase() ?? "";
    const localRecent = readLocalRecent(currentEmail);

    if (!supabase || !currentUser) {
      setRecentTools(localRecent);
      return;
    }

    const { data, error } = await supabase
      .from("recent_tools")
      .select("tool:tools(*)")
      .eq("user_id", currentUser.id)
      .order("viewed_at", { ascending: false })
      .limit(5);

    if (!error && data) {
      const recent = data
        .map((row) => row.tool)
        .flat()
        .filter(Boolean) as HglTool[];
      setRecentTools(recent.length > 0 ? recent : localRecent);
    } else {
      setRecentTools(localRecent);
    }
  }, []);

  const loadMembers = useCallback(async () => {
    if (!supabase || !isAdmin) return;
    const { data, error } = await supabase
      .from("hgl_members")
      .select("*")
      .order("email", { ascending: true });

    if (!error) {
      setMembers((data as HglMember[]) ?? []);
    }
  }, [isAdmin]);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    async function checkMember() {
      if (!supabase || !email || isAdmin) {
        setIsMember(false);
        return;
      }

      const { data } = await supabase
        .from("hgl_members")
        .select("email")
        .eq("email", email)
        .maybeSingle();
      setIsMember(Boolean(data));
    }

    checkMember();
  }, [email, isAdmin]);

  useEffect(() => {
    loadTools();
  }, [loadTools, canSeePrivate]);

  useEffect(() => {
    loadRecent(user);
  }, [loadRecent, user]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  useEffect(() => {
    function onPaste(event: ClipboardEvent) {
      if (!activeModal) return;
      const file = getFileFromClipboard(event);
      if (file) {
        setDraft((current) => ({
          ...current,
          logoFile: file,
          logoPreview: URL.createObjectURL(file),
        }));
      }
    }

    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [activeModal]);

  async function signIn() {
    if (!supabase) return;
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
      },
    });
  }

  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
  }

  function openAddModal() {
    setEditingTool(null);
    setDraft(emptyDraft);
    setActiveModal("add");
  }

  function openEditModal(tool: HglTool) {
    setEditingTool(tool);
    setDraft({
      name: tool.name,
      url: tool.url,
      description: tool.description,
      type: tool.type,
      logoFile: null,
      logoPreview: tool.logo_url,
    });
    setActiveModal("edit");
  }

  function closeModal() {
    setActiveModal(null);
    setEditingTool(null);
    setDraft(emptyDraft);
    setMemberEmail("");
  }

  function acceptLogoFile(file: File | null) {
    if (!file || !file.type.startsWith("image/")) return;
    setDraft((current) => ({
      ...current,
      logoFile: file,
      logoPreview: URL.createObjectURL(file),
    }));
  }

  async function uploadLogo(file: File) {
    if (!supabase) return null;
    const extension = file.name.split(".").pop() || "png";
    const path = `tool-logos/${crypto.randomUUID()}.${extension}`;
    const { error } = await supabase.storage.from("tool-logos").upload(path, file, {
      cacheControl: "3600",
      upsert: false,
    });

    if (error) throw error;
    const { data } = supabase.storage.from("tool-logos").getPublicUrl(path);
    return data.publicUrl;
  }

  async function saveTool() {
    if (!supabase || !isAdmin) return;
    if (!draft.name.trim() || !draft.url.trim()) {
      setMessage("Tool name and URL are required.");
      return;
    }

    try {
      let uploadedLogo: string | null = null;
      let logoWarning = "";

      if (draft.logoFile) {
        try {
          uploadedLogo = await uploadLogo(draft.logoFile);
        } catch (error) {
          logoWarning =
            error instanceof Error
              ? ` Saved without logo because upload failed: ${error.message}.`
              : " Saved without logo because upload failed.";
        }
      }

      if (editingTool) {
        const payload = {
          name: draft.name.trim(),
          url: draft.url.trim(),
          description: draft.description.trim(),
          type: draft.type,
          logo_url: uploadedLogo ?? editingTool.logo_url,
          updated_on: todayIsoDate(),
        };
        const { error } = await supabase.from("tools").update(payload).eq("id", editingTool.id);
        if (error) throw error;
      } else {
        const payload = {
          name: draft.name.trim(),
          url: draft.url.trim(),
          description: draft.description.trim(),
          type: draft.type,
          logo_url: uploadedLogo,
          updated_on: todayIsoDate(),
        };
        const { error } = await supabase.from("tools").insert(payload);
        if (error) throw error;
      }

      setMessage(`Saved successfully.${logoWarning}`);
      closeModal();
      await loadTools();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save tool.");
    }
  }

  async function deleteTool() {
    if (!supabase || !isAdmin || !editingTool) return;
    const { error } = await supabase.from("tools").delete().eq("id", editingTool.id);
    if (error) {
      setMessage(error.message);
      return;
    }
    setMessage("Tool deleted.");
    closeModal();
    await loadTools();
  }

  async function openTool(tool: HglTool) {
    const recentKey = email || "";
    const nextRecent = [tool, ...recentTools.filter((recentTool) => recentTool.id !== tool.id)].slice(
      0,
      5,
    );
    setRecentTools(nextRecent);
    writeLocalRecent(recentKey, nextRecent);

    if (supabase && user) {
      const { error } = await supabase.rpc("record_recent_tool", {
        p_tool_id: tool.id,
      });

      if (error) {
        setMessage(`Recently was saved locally only: ${error.message}`);
      } else {
        await loadRecent(user);
      }
    }
    window.location.href = tool.url;
  }

  async function addMember() {
    if (!supabase || !isAdmin) return;
    const normalized = memberEmail.trim().toLowerCase();
    if (!normalized.includes("@gmail.com")) {
      setMessage("Please enter a Gmail address.");
      return;
    }

    const { error } = await supabase.from("hgl_members").upsert({ email: normalized });
    if (error) {
      setMessage(error.message);
      return;
    }
    setMemberEmail("");
    await loadMembers();
  }

  async function removeMember(address: string) {
    if (!supabase || !isAdmin) return;
    const { error } = await supabase.from("hgl_members").delete().eq("email", address);
    if (error) {
      setMessage(error.message);
      return;
    }
    await loadMembers();
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="brand">
          <LabLogo />
          <h1>HGL Tools</h1>
        </div>

        <label className="search-box">
          <Search size={18} />
          <input
            aria-label="Search tools"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search tools, descriptions, type..."
            value={search}
          />
        </label>

        {user ? (
          <button className="signin secondary" onClick={signOut} type="button">
            <LogOut size={18} />
            Sign out
          </button>
        ) : (
          <button className="signin" disabled={!supabase} onClick={signIn} type="button">
            <LogIn size={18} />
            Sign in
          </button>
        )}
      </header>

      <section className="content">
        {!hasSupabaseEnv && (
          <div className="notice">
            Supabase environment variables are not configured yet. The UI is running with sample
            data until you add <code>NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
            <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>.
          </div>
        )}

        {message && (
          <button className="notice clickable" onClick={() => setMessage("")} type="button">
            {message}
          </button>
        )}

        <ToolSection
          canEdit={isAdmin}
          emptyText="No recently opened tools yet."
          loading={loading}
          onEdit={openEditModal}
          onOpen={openTool}
          title="Recently"
          tools={filteredRecentTools}
        />

        <ToolSection
          canEdit={isAdmin}
          emptyText="No tools match this view."
          loading={loading}
          onEdit={openEditModal}
          onOpen={openTool}
          title="Tools list"
          tools={visibleTools}
        />
      </section>

      <footer className="app-footer">
        <div className="footer-brand">
          <LabLogo compact />
          <span>Human Genetics Laboratory, University of Science, VNU-HCM</span>
        </div>

        {isAdmin && (
          <div className="admin-actions">
            <button onClick={openAddModal} type="button">
              <Plus size={17} />
              Add
            </button>
            <button onClick={() => setActiveModal("manage")} type="button">
              <Settings size={17} />
              Manage
            </button>
          </div>
        )}
      </footer>

      {(activeModal === "add" || activeModal === "edit") && (
        <div className="modal-backdrop" role="presentation">
          <section aria-modal="true" className="modal" role="dialog">
            <div className="modal-header">
              <h2>{activeModal === "add" ? "Add tool" : "Edit tool"}</h2>
              <button aria-label="Close" className="icon-button" onClick={closeModal} type="button">
                <X size={18} />
              </button>
            </div>

            <div className="form-grid">
              <label>
                Tool name
                <input
                  onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                  value={draft.name}
                />
              </label>
              <label>
                URL
                <input
                  onChange={(event) => setDraft({ ...draft, url: event.target.value })}
                  value={draft.url}
                />
              </label>
              <label className="full">
                Description
                <textarea
                  onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                  value={draft.description}
                />
              </label>
              <div className="type-choice">
                <span>Type</span>
                <button
                  className={draft.type === "public" ? "selected" : ""}
                  onClick={() => setDraft({ ...draft, type: "public" })}
                  type="button"
                >
                  Public
                </button>
                <button
                  className={draft.type === "private" ? "selected" : ""}
                  onClick={() => setDraft({ ...draft, type: "private" })}
                  type="button"
                >
                  Private
                </button>
              </div>
              <div
                className="logo-dropzone"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  acceptLogoFile(event.dataTransfer.files.item(0));
                }}
                role="button"
                tabIndex={0}
              >
                {draft.logoPreview ? (
                  <img alt="Selected tool logo" src={draft.logoPreview} />
                ) : (
                  <>
                    <ImagePlus size={28} />
                    <span>Click, drag, or Ctrl+V logo</span>
                  </>
                )}
                <input
                  accept="image/*"
                  hidden
                  onChange={(event) => acceptLogoFile(event.target.files?.item(0) ?? null)}
                  ref={fileInputRef}
                  type="file"
                />
              </div>
            </div>

            <div className="modal-actions">
              {activeModal === "edit" && (
                <button className="danger" onClick={deleteTool} type="button">
                  <Trash2 size={17} />
                  Delete
                </button>
              )}
              <button className="primary" onClick={saveTool} type="button">
                <Save size={17} />
                Save
              </button>
            </div>
          </section>
        </div>
      )}

      {activeModal === "manage" && (
        <div className="modal-backdrop" role="presentation">
          <section aria-modal="true" className="modal manage-modal" role="dialog">
            <div className="modal-header">
              <h2>HGLmem</h2>
              <button aria-label="Close" className="icon-button" onClick={closeModal} type="button">
                <X size={18} />
              </button>
            </div>

            <div className="member-add">
              <input
                onChange={(event) => setMemberEmail(event.target.value)}
                placeholder="gmail address"
                value={memberEmail}
              />
              <button onClick={addMember} type="button">
                <Plus size={17} />
                Add
              </button>
            </div>

            <div className="member-list">
              {members.map((member) => (
                <div className="member-row" key={member.email}>
                  <span>{member.email}</span>
                  <button
                    aria-label={`Remove ${member.email}`}
                    onClick={() => removeMember(member.email)}
                    type="button"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
              {members.length === 0 && <p>No HGLmem accounts yet.</p>}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

function ToolSection({
  canEdit,
  emptyText,
  loading,
  onEdit,
  onOpen,
  title,
  tools,
}: {
  canEdit: boolean;
  emptyText: string;
  loading: boolean;
  onEdit: (tool: HglTool) => void;
  onOpen: (tool: HglTool) => void;
  title: string;
  tools: HglTool[];
}) {
  return (
    <section className="tool-section">
      <div className="section-title">
        <h2>{title}</h2>
        <span>{tools.length} tools</span>
      </div>

      <div className="tool-table">
        <div className={canEdit ? "table-head admin" : "table-head"}>
          <span>No.</span>
          <span>Logo</span>
          <span>Tool name</span>
          <span>Description</span>
          <span>Updated</span>
          <span>Type</span>
          {canEdit && <span>Admin</span>}
        </div>

        {loading ? (
          <div className="empty-row">Loading tools...</div>
        ) : tools.length === 0 ? (
          <div className="empty-row">{emptyText}</div>
        ) : (
          tools.map((tool, index) => (
            <div className={canEdit ? "tool-row admin" : "tool-row"} key={`${title}-${tool.id}`}>
              <span className="row-number">{index + 1}</span>
              <ToolLogo tool={tool} />
              <button className="tool-link" onClick={() => onOpen(tool)} type="button">
                {tool.name}
                <ExternalLink size={14} />
              </button>
              <p>{tool.description}</p>
              <time dateTime={tool.updated_on}>{tool.updated_on}</time>
              <TypePill type={tool.type} />
              {canEdit && (
                <button className="edit-button" onClick={() => onEdit(tool)} type="button">
                  <Pencil size={15} />
                  Edit
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </section>
  );
}
