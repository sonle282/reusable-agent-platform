import { useEffect, useState, type FormEvent } from "react";
import { api, del, patch, post } from "../api";
import type { Me, Role } from "../types";
import { Alert, Badge, Button, Card, CopyField, Dialog, EmptyState, errorMessage, Field, initialsOf, Menu, Select, Sheet, TextInput, useToast, When } from "../ui";
import { PasswordField } from "./Auth";

export const roleInfo: Record<Role, { label: string; text: string }> = {
  owner: { label: "Owner", text: "Everything, including the AI key, channels and people." },
  manager: { label: "Manager", text: "Assistants, Data, chats and leads. Not channels, settings or people." },
  staff: { label: "Staff", text: "Home, Leads and Conversations." },
};

const displayName = (person: { name?: string | null; email: string }) => person.name?.trim() || person.email;

// ---------- Your account (everyone) ----------
export function AccountSection({ me, reload, logout }: { me: Me; reload: () => Promise<void>; logout: () => void }) {
  const toast = useToast();
  const [name, setName] = useState(me.name);
  const [editing, setEditing] = useState<"email" | "password" | null>(null);
  const [busy, setBusy] = useState(false);
  async function saveName() {
    setBusy(true);
    try {
      await patch("/api/admin/me", { name: name.trim() });
      await reload();
      toast("Name saved");
    } catch (caught) {
      toast(errorMessage(caught, "Couldn't save your name"), "error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Card title="Your account" footer={`${roleInfo[me.role].label}: ${roleInfo[me.role].text}`}>
        <div className="card-pad stack" style={{ gap: 16 }}>
          <Field label="Name" hint="Shown to your team instead of your email.">
            <div className="row-flex">
              <TextInput value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" autoComplete="name" />
              <Button variant="outline" busy={busy} disabled={name.trim() === me.name.trim()} onClick={() => void saveName()}>
                Save
              </Button>
            </div>
          </Field>
        </div>
        <div className="row compact">
          <span className="row-text">
            <span className="row-title">Email</span>
            <span className="row-sub xs truncate">{me.email}</span>
          </span>
          <Button variant="ghost" size="sm" onClick={() => setEditing("email")}>
            Change
          </Button>
        </div>
        <div className="row compact">
          <span className="row-text">
            <span className="row-title">Password</span>
            <span className="row-sub xs">A new password signs you out on other devices.</span>
          </span>
          <Button variant="ghost" size="sm" onClick={() => setEditing("password")}>
            Change
          </Button>
        </div>
        <div className="row compact">
          <span className="row-text">
            <span className="row-title">Sign out</span>
            <span className="row-sub xs">On this device.</span>
          </span>
          <Button variant="danger-ghost" size="sm" icon="logout" onClick={logout}>
            Sign out
          </Button>
        </div>
      </Card>
      {editing && <ChangeSheet kind={editing} me={me} onClose={() => setEditing(null)} onDone={async (message) => (setEditing(null), await reload(), toast(message))} />}
    </>
  );
}

function ChangeSheet({ kind, me, onClose, onDone }: { kind: "email" | "password"; me: Me; onClose: () => void; onDone: (message: string) => Promise<void> }) {
  const [current, setCurrent] = useState("");
  const [email, setEmail] = useState(me.email);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (kind === "email") await post("/api/admin/me/email", { current, email: email.trim() });
      else await post("/api/admin/me/password", { current, password });
      await onDone(kind === "email" ? "Email changed · use it next time you sign in" : "Password changed · other devices were signed out");
    } catch (caught) {
      setError(errorMessage(caught));
      setBusy(false);
    }
  }
  const valid = current.length > 0 && (kind === "email" ? email.trim().length > 3 && email.trim().toLowerCase() !== me.email : password.length >= 12);
  return (
    <Sheet
      title={kind === "email" ? "Change email" : "Change password"}
      onClose={onClose}
      footer={
        <>
          <span className="spacer" />
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="change-account" busy={busy} disabled={!valid}>
            Save
          </Button>
        </>
      }
    >
      <form id="change-account" className="sheet-form" onSubmit={submit}>
        {kind === "email" ? (
          <Field label="New email" hint="You'll sign in with this email from now on.">
            <TextInput type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" data-autofocus />
          </Field>
        ) : (
          <PasswordField id="new-password" label="New password" value={password} onChange={setPassword} autoComplete="new-password" strength />
        )}
        <PasswordField id="current-password" label="Current password" value={current} onChange={setCurrent} autoComplete="current-password" />
        {error && <Alert tone="danger" title="Couldn't save" text={error} />}
      </form>
    </Sheet>
  );
}

// ---------- People (owners) ----------
type Person = { id: string; email: string; name: string; role: Role; created_at: string; last_seen_at: string | null };
type Invite = { id: string; email: string; name: string; role: Role; expires_at: string; created_at: string };

export function PeopleSection({ me }: { me: Me }) {
  const toast = useToast();
  const [people, setPeople] = useState<{ users: Person[]; invites: Invite[] } | null>(null);
  const [error, setError] = useState("");
  const [inviting, setInviting] = useState(false);
  const [link, setLink] = useState<{ title: string; text: string; url: string } | null>(null);
  const [removing, setRemoving] = useState<Person | null>(null);
  const [busy, setBusy] = useState(false);
  async function load() {
    try {
      setPeople(await api<{ users: Person[]; invites: Invite[] }>("/api/admin/users"));
      setError("");
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }
  useEffect(() => void load(), []);
  async function changeRole(person: Person, role: Role) {
    try {
      await patch(`/api/admin/users/${person.id}`, { role });
      toast(`${displayName(person)} is now ${roleInfo[role].label.toLowerCase()}`);
      await load();
    } catch (caught) {
      toast(errorMessage(caught, "Couldn't change the role"), "error");
      await load();
    }
  }
  async function resetLink(person: Person) {
    try {
      const result = await post<{ link: string; expiresInDays: number }>(`/api/admin/users/${person.id}/reset-link`);
      setLink({ title: `Password link for ${displayName(person)}`, text: `Send it to ${person.email} on Zalo or SMS. It works once, expires in ${result.expiresInDays} days, and signs them out on other devices.`, url: result.link });
    } catch (caught) {
      toast(errorMessage(caught, "Couldn't make the link"), "error");
    }
  }
  async function cancelInvite(invite: Invite) {
    try {
      await del(`/api/admin/users/invites/${invite.id}`);
      toast("Invite cancelled · the link no longer works");
      await load();
    } catch (caught) {
      toast(errorMessage(caught, "Couldn't cancel the invite"), "error");
    }
  }
  return (
    <>
      <Card
        title="People"
        sub="Who can sign in to this workspace"
        action={
          <Button variant="outline" size="sm" icon="user-add" onClick={() => setInviting(true)}>
            Invite
          </Button>
        }
        footer="Owner: everything. Manager: assistants, Data, chats and leads. Staff: Home, Leads and Conversations."
      >
        {error && <Alert tone="danger" title="Couldn't load people" text={error} />}
        {!people && !error && <div className="card-pad xs t3">Loading…</div>}
        {people?.users.map((person) => (
          <div className="row compact" key={person.id}>
            <span className="avatar" aria-hidden="true">
              {initialsOf(displayName(person))}
            </span>
            <span className="row-text">
              <span className="row-title truncate">
                {displayName(person)}
                {person.id === me.id && <span className="t3"> (you)</span>}
              </span>
              <span className="row-sub xs truncate">
                {person.name ? `${person.email} · ` : ""}
                {person.last_seen_at ? (
                  <>
                    active <When value={person.last_seen_at} />
                  </>
                ) : (
                  "not signed in yet"
                )}
              </span>
            </span>
            <Select block={false} aria-label={`Role of ${displayName(person)}`} value={person.role} disabled={person.id === me.id} onChange={(event) => void changeRole(person, event.target.value as Role)}>
              {(Object.keys(roleInfo) as Role[]).map((role) => (
                <option key={role} value={role}>
                  {roleInfo[role].label}
                </option>
              ))}
            </Select>
            {person.id !== me.id && (
              <Menu
                label={`Actions for ${displayName(person)}`}
                items={[
                  { label: "Password link…", icon: "key", onSelect: () => void resetLink(person) },
                  { separator: true },
                  { label: "Remove…", icon: "trash", destructive: true, onSelect: () => setRemoving(person) },
                ]}
              />
            )}
          </div>
        ))}
        {people && people.invites.length > 0 && (
          <>
            <div className="row compact" style={{ paddingBottom: 0 }}>
              <span className="mini-label">Invited, not joined yet</span>
            </div>
            {people.invites.map((invite) => (
              <div className="row compact" key={invite.id}>
                <span className="avatar" aria-hidden="true" style={{ opacity: 0.6 }}>
                  {initialsOf(displayName(invite))}
                </span>
                <span className="row-text">
                  <span className="row-title truncate">{displayName(invite)}</span>
                  <span className="row-sub xs truncate">
                    {roleInfo[invite.role].label} · link expires <When value={invite.expires_at} />
                  </span>
                </span>
                <Badge>Invited</Badge>
                <Button variant="ghost" size="sm" onClick={() => void cancelInvite(invite)}>
                  Cancel
                </Button>
              </div>
            ))}
          </>
        )}
        {people && people.users.length === 1 && people.invites.length === 0 && (
          <EmptyState icon="users" title="Just you for now" text="Invite your team. Each person signs in with their own email and password." />
        )}
      </Card>
      {inviting && (
        <InviteSheet
          onClose={() => setInviting(false)}
          onDone={async (result) => {
            setInviting(false);
            setLink(result);
            await load();
          }}
        />
      )}
      {link && (
        <Sheet title={link.title} onClose={() => setLink(null)} footer={<Button onClick={() => setLink(null)}>Done</Button>}>
          <div className="sheet-form">
            <p className="t2" style={{ margin: 0 }}>
              {link.text}
            </p>
            <CopyField label="Link" value={link.url} />
            <Alert tone="info" text="The link is shown only now. If it gets lost, make a new one; the old one stops working." />
          </div>
        </Sheet>
      )}
      {removing && (
        <Dialog
          title={`Remove ${displayName(removing)}?`}
          text="They are signed out right away and can't sign in again. What they did stays in the history."
          confirmLabel="Remove"
          destructive
          busy={busy}
          onCancel={() => setRemoving(null)}
          onConfirm={async () => {
            setBusy(true);
            try {
              await del(`/api/admin/users/${removing.id}`);
              toast(`${displayName(removing)} removed`);
              await load();
            } catch (caught) {
              toast(errorMessage(caught, "Couldn't remove them"), "error");
            } finally {
              setBusy(false);
              setRemoving(null);
            }
          }}
        />
      )}
    </>
  );
}

function InviteSheet({ onClose, onDone }: { onClose: () => void; onDone: (link: { title: string; text: string; url: string }) => Promise<void> }) {
  const [form, setForm] = useState<{ email: string; name: string; role: Role }>({ email: "", name: "", role: "staff" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await post<{ link: string; expiresInDays: number }>("/api/admin/users/invites", { email: form.email.trim(), name: form.name.trim(), role: form.role });
      await onDone({
        title: `Invite for ${form.name.trim() || form.email.trim()}`,
        text: `Send this link on Zalo or SMS. They set their own password and sign in as ${roleInfo[form.role].label.toLowerCase()}. It works once and expires in ${result.expiresInDays} days.`,
        url: result.link,
      });
    } catch (caught) {
      setError(errorMessage(caught));
      setBusy(false);
    }
  }
  return (
    <Sheet
      title="Invite someone"
      subtitle="We make a one-time link for you to send. No email is sent."
      onClose={onClose}
      footer={
        <>
          <span className="spacer" />
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="invite-form" busy={busy} disabled={!/\S+@\S+\.\S+/.test(form.email.trim())}>
            Make invite link
          </Button>
        </>
      }
    >
      <form id="invite-form" className="sheet-form" onSubmit={submit}>
        <Field label="Email" hint="They sign in with this email.">
          <TextInput type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} autoComplete="off" data-autofocus required />
        </Field>
        <Field label="Name" hint="Optional. They can change it.">
          <TextInput value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} autoComplete="off" />
        </Field>
        <div className="field">
          <span className="field-label">Role</span>
          <div className="choice-list" role="radiogroup" aria-label="Role">
            {(["staff", "manager", "owner"] as Role[]).map((role) => (
              <button type="button" key={role} className="choice" role="radio" aria-checked={form.role === role} onClick={() => setForm({ ...form, role })}>
                <span className="stack spacer" style={{ gap: 0 }}>
                  <span className="medium">{roleInfo[role].label}</span>
                  <span className="xs t3">{roleInfo[role].text}</span>
                </span>
                <span className="radio-dot" aria-hidden="true" />
              </button>
            ))}
          </div>
        </div>
        {error && <Alert tone="danger" title="Couldn't make the invite" text={error} />}
      </form>
    </Sheet>
  );
}
