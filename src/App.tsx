import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Check,
  Clipboard,
  ExternalLink,
  FileText,
  Loader2,
  MessageSquare,
  Network,
  Radar,
  Sparkles,
  Target,
  Users
} from "lucide-react";
import { api } from "./lib/api";
import { seedDemo } from "./data/demo";
import type {
  DiscoveredPerson,
  OutcomeState,
  OutreachDraft,
  ParsedProfile,
  TrustPath
} from "./types/api";

const outcomeLabels: Record<OutcomeState, string> = {
  not_contacted: "Not contacted",
  contacted: "Contacted",
  replied: "Replied",
  referral: "Referral",
  dead_end: "Dead end"
};

const outcomeOptions = Object.keys(outcomeLabels) as OutcomeState[];

function readOutcomes(): Record<string, OutcomeState> {
  try {
    return JSON.parse(localStorage.getItem("zo.relationship.outcomes") || "{}") as Record<string, OutcomeState>;
  } catch {
    return {};
  }
}

function compactList(items: string[], max = 5): string {
  if (!items.length) return "No signals yet";
  const visible = items.slice(0, max).join(", ");
  return items.length > max ? `${visible} +${items.length - max}` : visible;
}

function LoadingButton({
  children,
  loading,
  disabled,
  onClick,
  variant = "primary"
}: {
  children: ReactNode;
  loading?: boolean;
  disabled?: boolean;
  onClick: () => void;
  variant?: "primary" | "secondary";
}) {
  return (
    <button className={`button ${variant}`} disabled={disabled || loading} onClick={onClick} type="button">
      {loading ? <Loader2 className="spin" size={16} /> : null}
      {children}
    </button>
  );
}

function StepRail({ activeStep }: { activeStep: number }) {
  const steps = [
    { icon: FileText, label: "Profile" },
    { icon: Target, label: "Target" },
    { icon: Radar, label: "Discovery" },
    { icon: Network, label: "Trust Paths" },
    { icon: MessageSquare, label: "Outreach" },
    { icon: Check, label: "Outcomes" }
  ];

  return (
    <aside className="step-rail" aria-label="Workflow steps">
      <div className="brand">
        <span className="brand-mark">ZR</span>
        <div>
          <strong>Zo Relationship Mapper</strong>
          <span>Trust-path sprint</span>
        </div>
      </div>
      <nav>
        {steps.map((step, index) => {
          const Icon = step.icon;
          const isActive = index <= activeStep;
          return (
            <div className={`step ${isActive ? "active" : ""}`} key={step.label}>
              <span className="step-icon">
                <Icon size={17} />
              </span>
              <span>{step.label}</span>
            </div>
          );
        })}
      </nav>
      <div className="rail-note">
        <strong>Positioning</strong>
        <span>Not a CRM. Not a resume coach. This maps credible people to contact before applying cold.</span>
      </div>
    </aside>
  );
}

function Panel({
  title,
  icon,
  action,
  children
}: {
  title: string;
  icon: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="panel">
      <div className="panel-header">
        <div className="panel-title">
          {icon}
          <h2>{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function ProfileSummary({ parsedProfile }: { parsedProfile: ParsedProfile | null }) {
  if (!parsedProfile) {
    return <p className="empty-copy">Parse the profile to extract companies, skills, domains, and proof-of-work.</p>;
  }

  return (
    <div className="summary">
      <p>{parsedProfile.careerSummary}</p>
      <dl>
        <div>
          <dt>Companies</dt>
          <dd>{compactList(parsedProfile.companies)}</dd>
        </div>
        <div>
          <dt>Skills</dt>
          <dd>{compactList(parsedProfile.skills, 6)}</dd>
        </div>
        <div>
          <dt>Domains</dt>
          <dd>{compactList(parsedProfile.domains)}</dd>
        </div>
      </dl>
      <div className="proof-list">
        {parsedProfile.proofOfWork.slice(0, 4).map((item) => (
          <span key={item}>{item}</span>
        ))}
      </div>
    </div>
  );
}

function DiscoveredPeopleList({
  people,
  selectedPath
}: {
  people: DiscoveredPerson[];
  selectedPath: TrustPath | null;
}) {
  if (!people.length) {
    return <p className="empty-copy">Run discovery to find public people and company pages related to the target.</p>;
  }

  return (
    <div className="people-list">
      {people.map((person) => (
        <article className={`person-row ${selectedPath?.personName === person.name ? "highlight" : ""}`} key={person.id}>
          <div>
            <div className="row-title">
              <strong>{person.name}</strong>
              <a href={person.url} rel="noreferrer" target="_blank" aria-label={`Open ${person.name} profile`}>
                <ExternalLink size={14} />
              </a>
            </div>
            <p>{person.title}</p>
            <span>{person.company}</span>
          </div>
          <p className="snippet">{person.snippet}</p>
          <div className="signal-wrap">
            {person.signals.slice(0, 4).map((signal) => (
              <span key={signal}>{signal}</span>
            ))}
          </div>
        </article>
      ))}
    </div>
  );
}

function TrustPathList({
  paths,
  selectedPathId,
  outcomes,
  onSelect,
  onOutcome
}: {
  paths: TrustPath[];
  selectedPathId: string | null;
  outcomes: Record<string, OutcomeState>;
  onSelect: (pathId: string) => void;
  onOutcome: (pathId: string, outcome: OutcomeState) => void;
}) {
  if (!paths.length) {
    return <p className="empty-copy">Rank trust paths to see who to contact, why, and what to ask for.</p>;
  }

  return (
    <div className="path-list">
      {paths.map((path, index) => (
        <article className={`path-card ${selectedPathId === path.id ? "selected" : ""}`} key={path.id}>
          <button className="path-select" type="button" onClick={() => onSelect(path.id)}>
            <span className="rank">#{index + 1}</span>
            <span>
              <strong>{path.personName}</strong>
              <small>
                {path.role} at {path.company}
              </small>
            </span>
            <span className={`score ${path.confidence}`}>{path.score}</span>
          </button>
          <p>{path.trustReason}</p>
          <div className="ask-box">
            <strong>Suggested ask</strong>
            <span>{path.suggestedAsk}</span>
          </div>
          <div className="risk-line">Risk: {path.risks[0]}</div>
          <div className="outcome-row" aria-label={`Outcome for ${path.personName}`}>
            {outcomeOptions.map((outcome) => (
              <button
                className={outcomes[path.id] === outcome ? "active" : ""}
                key={outcome}
                type="button"
                onClick={() => onOutcome(path.id, outcome)}
              >
                {outcomeLabels[outcome]}
              </button>
            ))}
          </div>
        </article>
      ))}
    </div>
  );
}

function OutreachPanel({
  draft,
  selectedPath,
  onCopy
}: {
  draft: OutreachDraft | null;
  selectedPath: TrustPath | null;
  onCopy: () => void;
}) {
  if (!selectedPath) {
    return <p className="empty-copy">Select a ranked trust path to generate contextual outreach.</p>;
  }

  if (!draft) {
    return (
      <p className="empty-copy">
        Ready to draft outreach for {selectedPath.personName}. Keep it warm, specific, and low-friction.
      </p>
    );
  }

  return (
    <div className="draft">
      <div className="draft-subject">
        <span>Subject</span>
        <strong>{draft.subject}</strong>
      </div>
      <pre>{draft.message}</pre>
      <div className="follow-up">
        <strong>Follow-up</strong>
        <span>{draft.followUp}</span>
      </div>
      <button className="button secondary copy-button" type="button" onClick={onCopy}>
        <Clipboard size={15} />
        Copy draft
      </button>
    </div>
  );
}

export default function App() {
  const seedQuery = useQuery({ queryKey: ["seed"], queryFn: api.getSeed });
  const [profileText, setProfileText] = useState(seedDemo.profileText);
  const [target, setTarget] = useState(seedDemo.target);
  const [parsedProfile, setParsedProfile] = useState<ParsedProfile | null>(seedDemo.parsedProfile);
  const [people, setPeople] = useState<DiscoveredPerson[]>(seedDemo.discoveredPeople);
  const [paths, setPaths] = useState<TrustPath[]>(seedDemo.rankedPaths);
  const [selectedPathId, setSelectedPathId] = useState<string | null>(seedDemo.rankedPaths[0]?.id ?? null);
  const [draft, setDraft] = useState<OutreachDraft | null>(seedDemo.outreachDraft);
  const [outcomes, setOutcomes] = useState<Record<string, OutcomeState>>(readOutcomes);
  const [notice, setNotice] = useState("Seed demo loaded. Add API keys to switch from fallback to live OpenAI/Exa.");

  useEffect(() => {
    if (!seedQuery.data) return;
    const seed = seedQuery.data.data;
    setProfileText(seed.profileText);
    setTarget(seed.target);
    setParsedProfile(seed.parsedProfile);
    setPeople(seed.discoveredPeople);
    setPaths(seed.rankedPaths);
    setSelectedPathId(seed.rankedPaths[0]?.id ?? null);
    setDraft(seed.outreachDraft);
    setNotice(seedQuery.data.reason ?? "Seed demo loaded.");
  }, [seedQuery.data]);

  useEffect(() => {
    localStorage.setItem("zo.relationship.outcomes", JSON.stringify(outcomes));
  }, [outcomes]);

  const selectedPath = useMemo(
    () => paths.find((path) => path.id === selectedPathId) ?? paths[0] ?? null,
    [paths, selectedPathId]
  );

  const activeStep = paths.length ? 5 : people.length ? 3 : parsedProfile ? 2 : 0;

  const parseMutation = useMutation({
    mutationFn: () => api.parseProfile({ profileText }),
    onSuccess: (result) => {
      setParsedProfile(result.data);
      setNotice(result.fallbackUsed ? `Fallback profile parser used: ${result.reason}` : "Profile parsed with OpenAI.");
    }
  });

  const discoverMutation = useMutation({
    mutationFn: () =>
      api.discoverTargets({
        target,
        parsedProfile: parsedProfile ?? seedDemo.parsedProfile
      }),
    onSuccess: (result) => {
      setPeople(result.data.results);
      setPaths([]);
      setDraft(null);
      setNotice(result.fallbackUsed ? `Fallback discovery used: ${result.reason}` : "Live Exa discovery completed.");
    }
  });

  const rankMutation = useMutation({
    mutationFn: () =>
      api.rankTrustPaths({
        target,
        parsedProfile: parsedProfile ?? seedDemo.parsedProfile,
        discoveredPeople: people
      }),
    onSuccess: (result) => {
      setPaths(result.data.paths);
      setSelectedPathId(result.data.paths[0]?.id ?? null);
      setDraft(null);
      setNotice(result.fallbackUsed ? `Fallback trust ranking used: ${result.reason}` : "Trust paths ranked with OpenAI.");
    }
  });

  const draftMutation = useMutation({
    mutationFn: () =>
      api.draftOutreach({
        target,
        parsedProfile: parsedProfile ?? seedDemo.parsedProfile,
        selectedPath: selectedPath!,
        tone: "warm, concise, non-desperate"
      }),
    onSuccess: (result) => {
      setDraft(result.data);
      setNotice(result.fallbackUsed ? `Fallback outreach used: ${result.reason}` : "Outreach drafted with OpenAI.");
    }
  });

  function loadDemo() {
    const seed = seedDemo;
    setProfileText(seed.profileText);
    setTarget(seed.target);
    setParsedProfile(seed.parsedProfile);
    setPeople(seed.discoveredPeople);
    setPaths(seed.rankedPaths);
    setSelectedPathId(seed.rankedPaths[0]?.id ?? null);
    setDraft(seed.outreachDraft);
    setNotice("Local seed demo restored.");
  }

  function updateOutcome(pathId: string, outcome: OutcomeState) {
    setOutcomes((current) => ({ ...current, [pathId]: outcome }));
  }

  async function copyDraft() {
    if (!draft) return;
    await navigator.clipboard.writeText(`${draft.subject}\n\n${draft.message}\n\nFollow-up: ${draft.followUp}`);
    setNotice("Outreach draft copied to clipboard.");
  }

  return (
    <main className="app-shell">
      <StepRail activeStep={activeStep} />
      <div className="workspace">
        <header className="topbar">
          <div>
            <h1>Trust Path Sprint</h1>
            <p>Find the most credible person to contact before applying cold.</p>
          </div>
          <div className="top-actions">
            <button className="button secondary" type="button" onClick={loadDemo}>
              <Sparkles size={15} />
              Load demo
            </button>
          </div>
        </header>

        <section className="target-strip">
          <label htmlFor="target-input">Target role, company, person, or opportunity</label>
          <div>
            <input
              id="target-input"
              value={target}
              onChange={(event) => setTarget(event.target.value)}
              placeholder="AI platform role at a climate tech startup"
            />
            <LoadingButton
              loading={discoverMutation.isPending}
              disabled={!target.trim() || !parsedProfile}
              onClick={() => discoverMutation.mutate()}
            >
              Discover
              <ArrowRight size={15} />
            </LoadingButton>
          </div>
        </section>

        <div className="notice" role="status">
          {notice}
        </div>

        <div className="primary-grid">
          <Panel
            title="Career Context"
            icon={<FileText size={18} />}
            action={
              <LoadingButton
                loading={parseMutation.isPending}
                disabled={!profileText.trim()}
                onClick={() => parseMutation.mutate()}
                variant="secondary"
              >
                Parse
              </LoadingButton>
            }
          >
            <textarea
              value={profileText}
              onChange={(event) => setProfileText(event.target.value)}
              aria-label="Career profile or resume"
            />
            <ProfileSummary parsedProfile={parsedProfile} />
          </Panel>

          <Panel
            title="Discovered People"
            icon={<Users size={18} />}
            action={<span className="count">{people.length} results</span>}
          >
            <DiscoveredPeopleList people={people} selectedPath={selectedPath} />
          </Panel>

          <Panel
            title="Ranked Trust Paths"
            icon={<Network size={18} />}
            action={
              <LoadingButton
                loading={rankMutation.isPending}
                disabled={!people.length}
                onClick={() => rankMutation.mutate()}
                variant="secondary"
              >
                Rank
              </LoadingButton>
            }
          >
            <TrustPathList
              paths={paths}
              selectedPathId={selectedPath?.id ?? null}
              outcomes={outcomes}
              onSelect={setSelectedPathId}
              onOutcome={updateOutcome}
            />
          </Panel>
        </div>

        <Panel
          title="Outreach Draft"
          icon={<MessageSquare size={18} />}
          action={
            <LoadingButton
              loading={draftMutation.isPending}
              disabled={!selectedPath}
              onClick={() => draftMutation.mutate()}
              variant="secondary"
            >
              Generate draft
            </LoadingButton>
          }
        >
          <OutreachPanel draft={draft} selectedPath={selectedPath} onCopy={copyDraft} />
        </Panel>
      </div>
    </main>
  );
}
