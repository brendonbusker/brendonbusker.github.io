import { Button } from "@fluentui/react-components";
import {
  Add24Regular,
  WindowEditRegular,
  AppsAddIn24Regular,
  PersonEdit24Regular,
} from "@fluentui/react-icons";
export function Dashboard({ go }: { go: (p: string) => void }) {
  return (
    <div className="workspace-page dashboard">
      <header>
        <p className="page-label">Tuesday, September 1</p>
        <h1>Good evening, Brendon.</h1>
        <p>Pick up where you left off or start something new.</p>
      </header>
      <section>
        <h2>Quick actions</h2>
        <div className="quick-actions">
          <Button icon={<Add24Regular />} onClick={() => go("posts")}>
            New post
          </Button>
          <Button icon={<WindowEditRegular />} onClick={() => go("site")}>
            Edit homepage
          </Button>
          <Button icon={<AppsAddIn24Regular />} onClick={() => go("projects")}>
            Add project
          </Button>
          <Button icon={<PersonEdit24Regular />} onClick={() => go("resume")}>
            Edit résumé
          </Button>
        </div>
      </section>
      <section className="dashboard-columns">
        <div>
          <h2>Current site</h2>
          <dl>
            <div>
              <dt>Latest post</dt>
              <dd>Building a place for the work between projects</dd>
            </div>
            <div>
              <dt>Projects</dt>
              <dd>2 published</dd>
            </div>
            <div>
              <dt>Résumé</dt>
              <dd>Updated August 31, 2026</dd>
            </div>
          </dl>
        </div>
        <div>
          <h2>Publishing</h2>
          <p className="deployment-status">
            <span /> GitHub Pages configuration ready
          </p>
          <p>
            Published changes create a focused Git commit and start the site
            deployment. Drafts stay private until you publish.
          </p>
        </div>
      </section>
    </div>
  );
}
