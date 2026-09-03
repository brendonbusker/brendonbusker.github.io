import { pbkdf2Sync, randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import process from "node:process";

function hidden(prompt: string) {
  return new Promise<string>((resolve) => {
    process.stdout.write(prompt);
    let value = "";
    const stdin = process.stdin;
    stdin.setRawMode?.(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    const onData = (key: string) => {
      if (key === "\u0003") process.exit(130);
      if (key === "\r" || key === "\n") {
        stdin.setRawMode?.(false);
        stdin.pause();
        stdin.off("data", onData);
        process.stdout.write("\n");
        resolve(value);
      } else if (key === "\u007f" || key === "\b") {
        value = value.slice(0, -1);
      } else if (key >= " ") {
        value += key;
      }
    };
    stdin.on("data", onData);
  });
}
function putSecret(name: string, value: string) {
  const result = spawnSync(
    "pnpm",
    ["--filter", "@brendon/admin", "exec", "wrangler", "secret", "put", name],
    {
      input: value + "\n",
      stdio: ["pipe", "inherit", "inherit"],
      shell: process.platform === "win32",
    },
  );
  if (result.status !== 0) throw new Error(`Could not store ${name}`);
}

function copyPasswordToClipboard(value: string) {
  if (process.platform !== "win32") {
    throw new Error(
      "Generated-password mode currently requires Windows clipboard support.",
    );
  }
  const result = spawnSync(
    "powershell.exe",
    [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      "$passwordText = [Console]::In.ReadToEnd(); Set-Clipboard -Value $passwordText",
    ],
    { input: value, stdio: ["pipe", "ignore", "inherit"] },
  );
  if (result.status !== 0)
    throw new Error("Could not copy the generated password to the clipboard.");
}

async function main() {
  const generate = process.argv.includes("--generate");
  const username = generate
    ? "admin"
    : (await new Promise<string>((resolve) => {
        process.stdout.write("Admin username: ");
        process.stdin.once("data", (d) => resolve(String(d).trim()));
      })) || "admin";
  const first = generate
    ? randomBytes(24).toString("base64url")
    : await hidden("Admin password (20+ characters): ");
  const second = generate ? first : await hidden("Confirm password: ");
  if (first !== second) throw new Error("Passwords did not match.");
  if (first.length < 20)
    throw new Error("Password must be at least 20 characters.");
  const salt = randomBytes(24),
    pepper = randomBytes(32);
  const verifier = pbkdf2Sync(
    first + pepper.toString("base64"),
    salt,
    100000,
    32,
    "sha256",
  ).toString("base64");
  putSecret("ADMIN_USERNAME", username);
  putSecret("ADMIN_PASSWORD_SALT", salt.toString("base64"));
  putSecret("ADMIN_PASSWORD_PEPPER", pepper.toString("base64"));
  putSecret("ADMIN_PASSWORD_VERIFIER", verifier);
  if (generate) copyPasswordToClipboard(first);
  console.log(
    generate
      ? "Administrator verifier stored. The generated password is on the Windows clipboard; save it now in a password manager."
      : "Administrator verifier stored in Cloudflare. The plaintext password was not printed or written to disk.",
  );
}
main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : "Credential setup failed.",
  );
  process.exitCode = 1;
});
