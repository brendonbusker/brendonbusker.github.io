import { Spinner } from "@fluentui/react-components";
import {
  CheckmarkCircle16Regular,
  ErrorCircle16Regular,
} from "@fluentui/react-icons";
import type { SaveState } from "../hooks";
export function SaveStatus({
  state,
  error,
}: {
  state: SaveState;
  error?: string;
}) {
  return (
    <span
      className={`save-status ${state}`}
      title={error || undefined}
      aria-live="polite"
    >
      {state === "saving" ? (
        <>
          <Spinner size="tiny" /> Saving…
        </>
      ) : state === "saved" ? (
        <>
          <CheckmarkCircle16Regular /> Saved
        </>
      ) : state === "error" ? (
        <>
          <ErrorCircle16Regular /> Couldn’t save
        </>
      ) : state === "unsaved" ? (
        "Unsaved changes"
      ) : (
        "Ready"
      )}
    </span>
  );
}
