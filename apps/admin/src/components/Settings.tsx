import type { CSSProperties } from "react";
import { Field, Input, Switch } from "@fluentui/react-components";
import { CheckmarkCircle20Filled } from "@fluentui/react-icons";
import {
  adminThemes,
  type AdminThemeDefinition,
  type AdminThemeId,
} from "../themes";

type SettingsProps = {
  themeId: AdminThemeId;
  onThemeChange: (theme: AdminThemeId) => void;
};

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
  return (
    <div className="workspace-page form-page settings-page">
      <header className="command-header">
        <div>
          <p className="page-label">Settings</p>
          <h1>Admin settings</h1>
          <p>
            Personalize this private workspace. These themes never affect the
            public website.
          </p>
        </div>
      </header>

      <section className="theme-panel" aria-labelledby="theme-heading">
        <div className="settings-section-heading">
          <div>
            <p className="page-label">Theme playground</p>
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
    </div>
  );
}
