import { useEffect, useState, type CSSProperties } from "react";
import {
  Button,
  Field,
  Input,
  Spinner,
  Switch,
} from "@fluentui/react-components";
import { CheckmarkCircle20Filled, Send20Regular } from "@fluentui/react-icons";
import {
  appearanceSchema,
  type Appearance,
  type PublicThemeChoice,
} from "@brendon/shared";
import { draftsApi, publishedApi } from "../api";
import {
  adminThemes,
  type AdminThemeDefinition,
  type AdminThemeId,
} from "../themes";

type SettingsProps = {
  themeId: AdminThemeId;
  onThemeChange: (theme: AdminThemeId) => void;
};

const initialAppearance = appearanceSchema.parse({});
const curatedThemes: PublicThemeChoice[] = [
  "light",
  "dark",
  "midnight",
  "hacker",
  "sakura",
  "system",
];

function previewStyle(theme: AdminThemeDefinition) {
  return {
    "--preview-bg": theme.colors.background,
    "--preview-surface": theme.colors.surface,
    "--preview-nav": theme.colors.nav,
    "--preview-text": theme.colors.text,
    "--preview-muted": theme.colors.muted,
    "--preview-border": theme.colors.border,
    "--preview-accent": theme.colors.accent,
    "--preview-accent-soft": theme.colors.accentSoft,
  } as CSSProperties;
}

export function Settings({ themeId, onThemeChange }: SettingsProps) {
  const [appearance, setAppearance] = useState<Appearance>(initialAppearance);
  const [appearanceSource, setAppearanceSource] = useState<{
    path: string;
    sha: string;
  } | null>(null);
  const [loadingAppearance, setLoadingAppearance] = useState(true);
  const [publishingAppearance, setPublishingAppearance] = useState(false);
  const [appearanceDirty, setAppearanceDirty] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let alive = true;
    publishedApi
      .one<Appearance>("appearance")
      .then(({ content, path, sha }) => {
        if (!alive) return;
        setAppearance(appearanceSchema.parse(content));
        setAppearanceSource({ path, sha });
      })
      .catch((error) => {
        if (alive)
          setMessage(
            error instanceof Error
              ? error.message
              : "Could not load public theme settings.",
          );
      })
      .finally(() => {
        if (alive) setLoadingAppearance(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const updateAppearance = (next: Appearance) => {
    setAppearance(next);
    setAppearanceDirty(true);
    setMessage("");
  };

  const toggleVisitorTheme = (choice: PublicThemeChoice) => {
    const selected = appearance.visitorThemes.includes(choice);
    updateAppearance({
      ...appearance,
      visitorThemes: selected
        ? appearance.visitorThemes.filter((item) => item !== choice)
        : [...appearance.visitorThemes, choice],
    });
  };

  const publishAppearance = async () => {
    if (!appearanceSource) return;
    setPublishingAppearance(true);
    setMessage("");
    try {
      const valid = appearanceSchema.parse(appearance);
      const result = await draftsApi.publish("appearance", valid, {
        expectedSha: appearanceSource.sha,
      });
      setAppearance(valid);
      setAppearanceSource({ path: result.path, sha: result.contentSha });
      setAppearanceDirty(false);
      setMessage(
        `Public themes published. Site deployment is in progress. Version ${result.version.slice(0, 8)}.`,
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Public theme publishing failed.",
      );
    } finally {
      setPublishingAppearance(false);
    }
  };

  const allChoices: PublicThemeChoice[] = [
    ...adminThemes.map((theme) => theme.id),
    "system",
  ];

  return (
    <div className="workspace-page form-page settings-page">
      <header className="command-header">
        <div>
          <p className="page-label">Settings</p>
          <h1>Appearance and publishing</h1>
          <p>
            Personalize your private workspace and control the themes available
            on the public site.
          </p>
        </div>
      </header>

      <section className="theme-panel" aria-labelledby="theme-heading">
        <div className="settings-section-heading">
          <div>
            <p className="page-label">Private admin</p>
            <h2 id="theme-heading">Choose your atmosphere</h2>
          </div>
          <p>Saved automatically on this browser.</p>
        </div>
        <div className="theme-grid">
          {adminThemes.map((theme) => {
            const selected = theme.id === themeId;
            return (
              <button
                key={theme.id}
                type="button"
                className={`theme-card${selected ? " selected" : ""}`}
                aria-pressed={selected}
                aria-label={`Use ${theme.name} theme`}
                onClick={() => onThemeChange(theme.id)}
              >
                <span className="theme-preview" style={previewStyle(theme)}>
                  <span className="theme-preview-bar">
                    <i />
                    <i />
                    <i />
                  </span>
                  <span className="theme-preview-body">
                    <span className="theme-preview-nav">
                      <i />
                      <i />
                      <i />
                    </span>
                    <span className="theme-preview-content">
                      <i className="wide" />
                      <i />
                      <i />
                      <b />
                    </span>
                  </span>
                </span>
                <span className="theme-card-copy">
                  <span>
                    <strong>{theme.name}</strong>
                    <small>{theme.mood}</small>
                  </span>
                  {selected && <CheckmarkCircle20Filled aria-hidden="true" />}
                </span>
                <span className="theme-description">{theme.description}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section
        className="public-theme-panel"
        aria-labelledby="public-theme-heading"
      >
        <div className="settings-section-heading">
          <div>
            <p className="page-label">Public website</p>
            <h2 id="public-theme-heading">Visitor theme controls</h2>
          </div>
          <Button
            appearance="primary"
            icon={
              publishingAppearance ? <Spinner size="tiny" /> : <Send20Regular />
            }
            disabled={
              loadingAppearance ||
              publishingAppearance ||
              !appearanceSource ||
              !appearanceDirty
            }
            onClick={publishAppearance}
          >
            {publishingAppearance ? "Publishing…" : "Publish public themes"}
          </Button>
        </div>

        {loadingAppearance ? (
          <div className="appearance-loading">
            <Spinner label="Loading public theme settings…" />
          </div>
        ) : (
          <>
            <div className="appearance-controls">
              <label>
                <span>Default public theme</span>
                <select
                  aria-label="Default public theme"
                  value={appearance.defaultTheme}
                  onChange={(event) =>
                    updateAppearance({
                      ...appearance,
                      defaultTheme: event.target.value as PublicThemeChoice,
                    })
                  }
                >
                  <option value="system">Match visitor system</option>
                  {adminThemes.map((theme) => (
                    <option key={theme.id} value={theme.id}>
                      {theme.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Résumé appearance</span>
                <select
                  aria-label="Résumé appearance"
                  value={appearance.resumeThemeMode}
                  onChange={(event) =>
                    updateAppearance({
                      ...appearance,
                      resumeThemeMode: event.target
                        .value as Appearance["resumeThemeMode"],
                    })
                  }
                >
                  <option value="light">Always Light</option>
                  <option value="active">Match visitor selection</option>
                  <option value="default">Use public default</option>
                </select>
              </label>
              <Switch
                checked={appearance.allowVisitorSelection}
                label="Allow visitors to choose a theme"
                onChange={(_, data) =>
                  updateAppearance({
                    ...appearance,
                    allowVisitorSelection: data.checked,
                  })
                }
              />
            </div>

            <div className="public-theme-list-heading">
              <div>
                <h3>Themes visitors can choose</h3>
                <p>
                  “Site default” is always available. Select any combination
                  below.
                </p>
              </div>
              <div>
                <Button
                  size="small"
                  onClick={() =>
                    updateAppearance({
                      ...appearance,
                      visitorThemes: allChoices,
                    })
                  }
                >
                  Select all
                </Button>
                <Button
                  size="small"
                  onClick={() =>
                    updateAppearance({
                      ...appearance,
                      visitorThemes: curatedThemes,
                    })
                  }
                >
                  Curated set
                </Button>
                <Button
                  size="small"
                  onClick={() =>
                    updateAppearance({ ...appearance, visitorThemes: [] })
                  }
                >
                  Clear
                </Button>
              </div>
            </div>

            <div className="public-theme-options">
              {adminThemes.map((theme) => (
                <label key={theme.id} className="public-theme-option">
                  <input
                    type="checkbox"
                    checked={appearance.visitorThemes.includes(theme.id)}
                    onChange={() => toggleVisitorTheme(theme.id)}
                  />
                  <i style={{ background: theme.colors.accent }} />
                  <span>{theme.name}</span>
                </label>
              ))}
              <label className="public-theme-option system-option">
                <input
                  type="checkbox"
                  checked={appearance.visitorThemes.includes("system")}
                  onChange={() => toggleVisitorTheme("system")}
                />
                <i />
                <span>Match System</span>
              </label>
            </div>
          </>
        )}
      </section>

      <section className="single-form settings-system-panel">
        <h2>Publishing</h2>
        <Field label="Public site URL">
          <Input value="https://brendonbusker.github.io" readOnly />
        </Field>
        <Field label="GitHub branch">
          <Input value="main" readOnly />
        </Field>
        <Switch
          checked
          label="Require confirmation before destructive actions"
        />
        <Switch checked label="Warn before leaving with unsaved changes" />
        <h2>Security</h2>
        <p className="settings-note">
          Credentials, the GitHub token, Turnstile secret, and session secret
          are managed through Wrangler secrets and never exposed to this
          application.
        </p>
      </section>
      {message && (
        <div
          className={
            /failed|could not|error/i.test(message)
              ? "publish-message error"
              : "publish-message"
          }
          role="status"
        >
          {message}
        </div>
      )}
    </div>
  );
}
