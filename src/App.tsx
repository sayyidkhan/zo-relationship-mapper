import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { seedDemo } from "./data/demo";
import { api } from "./lib/api";
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

function shortList(items: string[], max = 4) {
  if (!items.length) return "No signals yet";
  const visible = items.slice(0, max).join(", ");
  return items.length > max ? `${visible} +${items.length - max}` : visible;
}

function statusText(fallbackUsed?: boolean, reason?: string) {
  if (!fallbackUsed) return "Live signal complete.";
  return reason ? reason.replace(/\.$/, "") : "Demo fallback used";
}

function ProgressRail({ activeStep }: { activeStep: number }) {
  const steps = [
    { icon: FileText, label: "Profile" },
    { icon: Target, label: "Target" },
    { icon: Radar, label: "Discovery" },
    { icon: Network, label: "Paths" },
    { icon: MessageSquare, label: "Draft" }
  ];

  return (
    <aside className="progress-rail" aria-label="Sprint progress">
      {steps.map((step, index) => {
        const Icon = step.icon;
        return (
          <div className={`rail-step ${index <= activeStep ? "active" : ""}`} key={step.label}>
            <span>
              <Icon size={16} />
            </span>
            <strong>{step.label}</strong>
          </div>
        );
      })}
    </aside>
  );
}

function ProfileBlock({
  profileText,
  parsedProfile,
  loading,
  onProfileChange,
  onParse
}: {
  profileText: string;
  parsedProfile: ParsedProfile | null;
  loading: boolean;
  onProfileChange: (value: string) => void;
  onParse: () => void;
}) {
  return (
    <section className="profile-block">
      <div className="section-kicker">Career context</div>
      <textarea
        aria-label="Career profile or resume"
        value={profileText}
        onChange={(event) => onProfileChange(event.target.value)}
      />
      <div className="profile-actions">
        <button className="ghost-button" disabled={loading || !profileText.trim()} onClick={onParse} type="button">
          {loading ? <Loader2 className="spin" size={15} /> : <FileText size={15} />}
          Parse profile
        </button>
      </div>
      {parsedProfile ? (
        <div className="profile-summary">
          <p>{parsedProfile.careerSummary}</p>
          <dl>
            <div>
              <dt>Companies</dt>
              <dd>{shortList(parsedProfile.companies)}</dd>
            </div>
            <div>
              <dt>Skills</dt>
              <dd>{shortList(parsedProfile.skills, 5)}</dd>
            </div>
            <div>
              <dt>Domains</dt>
              <dd>{shortList(parsedProfile.domains)}</dd>
            </div>
          </dl>
          <div className="proof-stack">
            {parsedProfile.proofOfWork.slice(0, 4).map((proof) => (
              <span key={proof}>{proof}</span>
            ))}
          </div>
        </div>
      ) : (
        <div className="empty-state">Paste a profile and parse it into opportunity signals.</div>
      )}
    </section>
  );
}

function PeopleBoard({
  people,
  selectedPath,
  onSelectPerson
}: {
  people: DiscoveredPerson[];
  selectedPath: TrustPath | null;
  onSelectPerson: (personName: string) => void;
}) {
  return (
    <section className="people-board">
      <div className="section-head">
        <div>
          <div className="section-kicker">Discovered people</div>
          <h2>{people.length ? `${people.length} public signals` : "No people discovered yet"}</h2>
        </div>
        <Users size={18} />
      </div>

      <div className="people-table">
        {people.length ? (
          <>
            <div className="people-header" aria-hidden="true">
              <span>Person</span>
              <span>Company</span>
              <span>Signal</span>
            </div>
            {people.map((person) => (
              <button
                className={`person-line ${selectedPath?.personName === person.name ? "selected" : ""}`}
                key={person.id}
                onClick={() => onSelectPerson(person.name)}
                type="button"
              >
                <span className="identity">
                  <strong>{person.name}</strong>
                  <small>{person.title}</small>
                </span>
                <span className="company">{person.company}</span>
                <span className="signals">{person.signals.slice(0, 2).join(" / ")}</span>
                <a href={person.url} onClick={(event) => event.stopPropagation()} rel="noreferrer" target="_blank">
                  <ExternalLink size={14} />
                </a>
              </button>
            ))}
          </>
        ) : (
          <div className="empty-state">Run discovery to find public people connected to the target.</div>
        )}
      </div>
    </section>
  );
}

function BestPathPane({
  selectedPath,
  outcomes,
  onOutcome,
  onRank,
  ranking
}: {
  selectedPath: TrustPath | null;
  outcomes: Record<string, OutcomeState>;
  onOutcome: (pathId: string, outcome: OutcomeState) => void;
  onRank: () => void;
  ranking: boolean;
}) {
  return (
    <aside className="best-pane">
      <div className="section-head">
        <div>
          <div className="section-kicker">Best path</div>
          <h2>{selectedPath ? selectedPath.personName : "Rank paths"}</h2>
        </div>
        <button className="ghost-button" disabled={ranking} onClick={onRank} type="button">
          {ranking ? <Loader2 className="spin" size={15} /> : <Network size={15} />}
          Rank
        </button>
      </div>

      {selectedPath ? (
        <>
          <div className="score-lockup">
            <span>{selectedPath.score}</span>
            <div>
              <strong>{selectedPath.role}</strong>
              <small>{selectedPath.company}</small>
            </div>
          </div>

          <div className="reason-stack">
            <div>
              <span>Why this path</span>
              <p>{selectedPath.trustReason}</p>
            </div>
            <div>
              <span>Suggested ask</span>
              <p>{selectedPath.suggestedAsk}</p>
            </div>
            <div>
              <span>Risk</span>
              <p>{selectedPath.risks[0]}</p>
            </div>
          </div>

          <div className="outcomes" aria-label={`Outcome for ${selectedPath.personName}`}>
            {outcomeOptions.map((outcome) => (
              <button
                className={outcomes[selectedPath.id] === outcome ? "active" : ""}
                key={outcome}
                onClick={() => onOutcome(selectedPath.id, outcome)}
                type="button"
              >
                {outcomeLabels[outcome]}
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="empty-state">Rank trust paths to choose who to contact first.</div>
      )}
    </aside>
  );
}

function DraftComposer({
  draft,
  selectedPath,
  generating,
  onGenerate,
  onCopy
}: {
  draft: OutreachDraft | null;
  selectedPath: TrustPath | null;
  generating: boolean;
  onGenerate: () => void;
  onCopy: () => void;
}) {
  return (
    <section className="draft-composer">
      <div className="section-head">
        <div>
          <div className="section-kicker">Outreach draft</div>
          <h2>{selectedPath ? `Message for ${selectedPath.personName}` : "Select a path first"}</h2>
        </div>
        <button className="ghost-button" disabled={!selectedPath || generating} onClick={onGenerate} type="button">
          {generating ? <Loader2 className="spin" size={15} /> : <MessageSquare size={15} />}
          Generate
        </button>
      </div>

      {draft ? (
        <div className="draft-grid">
          <div className="subject-line">
            <span>Subject</span>
            <strong>{draft.subject}</strong>
          </div>
          <pre>{draft.message}</pre>
          <div className="follow-line">
            <span>Follow-up</span>
            <p>{draft.followUp}</p>
          </div>
          <button className="copy-action" onClick={onCopy} type="button">
            <Clipboard size={15} />
            Copy draft
          </button>
        </div>
      ) : (
        <div className="empty-state">Generate a concise, contextual message that does not ask for a referral too early.</div>
      )}
    </section>
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
  const [notice, setNotice] = useState("Seed demo data is ready.");
  const [loading, setLoading] = useState<"idle" | "parse" | "discover" | "rank" | "draft" | "sprint">("idle");

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
    setNotice(seedQuery.data.reason ?? "Seed demo data is ready.");
  }, [seedQuery.data]);

  useEffect(() => {
    localStorage.setItem("zo.relationship.outcomes", JSON.stringify(outcomes));
  }, [outcomes]);

  const selectedPath = useMemo(
    () => paths.find((path) => path.id === selectedPathId) ?? paths[0] ?? null,
    [paths, selectedPathId]
  );

  const activeStep = draft ? 4 : paths.length ? 3 : people.length ? 2 : parsedProfile ? 1 : 0;
  const isBusy = loading !== "idle";

  async function parseProfile() {
    setLoading("parse");
    try {
      const result = await api.parseProfile({ profileText });
      setParsedProfile(result.data);
      setNotice(`Profile parsed. ${statusText(result.fallbackUsed, result.reason)}`);
      return result.data;
    } finally {
      setLoading("idle");
    }
  }

  async function discoverTargets(profile = parsedProfile ?? seedDemo.parsedProfile) {
    setLoading("discover");
    try {
      const result = await api.discoverTargets({ target, parsedProfile: profile });
      setPeople(result.data.results);
      setPaths([]);
      setDraft(null);
      setNotice(`Discovery complete. ${statusText(result.fallbackUsed, result.reason)}`);
      return result.data.results;
    } finally {
      setLoading("idle");
    }
  }

  async function rankPaths(profile = parsedProfile ?? seedDemo.parsedProfile, discovered = people) {
    setLoading("rank");
    try {
      const result = await api.rankTrustPaths({ target, parsedProfile: profile, discoveredPeople: discovered });
      setPaths(result.data.paths);
      setSelectedPathId(result.data.paths[0]?.id ?? null);
      setDraft(null);
      setNotice(`Paths ranked. ${statusText(result.fallbackUsed, result.reason)}`);
      return result.data.paths;
    } finally {
      setLoading("idle");
    }
  }

  async function generateDraft(path = selectedPath) {
    if (!path) return null;
    setLoading("draft");
    try {
      const result = await api.draftOutreach({
        target,
        parsedProfile: parsedProfile ?? seedDemo.parsedProfile,
        selectedPath: path,
        tone: "warm, concise, non-desperate"
      });
      setDraft(result.data);
      setNotice(`Draft ready. ${statusText(result.fallbackUsed, result.reason)}`);
      return result.data;
    } finally {
      setLoading("idle");
    }
  }

  async function runSprint() {
    setLoading("sprint");
    try {
      const parsed = await api.parseProfile({ profileText });
      setParsedProfile(parsed.data);

      const discovered = await api.discoverTargets({ target, parsedProfile: parsed.data });
      setPeople(discovered.data.results);

      const ranked = await api.rankTrustPaths({
        target,
        parsedProfile: parsed.data,
        discoveredPeople: discovered.data.results
      });
      setPaths(ranked.data.paths);
      const bestPath = ranked.data.paths[0] ?? null;
      setSelectedPathId(bestPath?.id ?? null);

      if (bestPath) {
        const drafted = await api.draftOutreach({
          target,
          parsedProfile: parsed.data,
          selectedPath: bestPath,
          tone: "warm, concise, non-desperate"
        });
        setDraft(drafted.data);
      }

      setNotice("Sprint complete. Review the best path, copy the draft, then track the outcome.");
    } finally {
      setLoading("idle");
    }
  }

  function loadDemo() {
    setProfileText(seedDemo.profileText);
    setTarget(seedDemo.target);
    setParsedProfile(seedDemo.parsedProfile);
    setPeople(seedDemo.discoveredPeople);
    setPaths(seedDemo.rankedPaths);
    setSelectedPathId(seedDemo.rankedPaths[0]?.id ?? null);
    setDraft(seedDemo.outreachDraft);
    setNotice("Demo reset.");
  }

  function selectPerson(personName: string) {
    const matchingPath = paths.find((path) => path.personName === personName);
    if (matchingPath) setSelectedPathId(matchingPath.id);
  }

  function updateOutcome(pathId: string, outcome: OutcomeState) {
    setOutcomes((current) => ({ ...current, [pathId]: outcome }));
  }

  async function copyDraft() {
    if (!draft) return;
    await navigator.clipboard.writeText(`${draft.subject}\n\n${draft.message}\n\nFollow-up: ${draft.followUp}`);
    setNotice("Draft copied.");
  }

  return (
    <main className="app-shell">
      <header className="command-bar">
        <div className="brand-lockup">
          <span>ZR</span>
          <div>
            <strong>Zo Relationship Mapper</strong>
            <small>Trust Path Sprint</small>
          </div>
        </div>

        <div className="target-command">
          <Target size={16} />
          <input
            aria-label="Target role, company, person, or opportunity"
            value={target}
            onChange={(event) => setTarget(event.target.value)}
            placeholder="AI platform role at a climate tech startup"
          />
          <button disabled={loading === "discover" || !target.trim()} onClick={() => discoverTargets()} type="button">
            {loading === "discover" ? <Loader2 className="spin" size={16} /> : <ArrowRight size={16} />}
            Discover
          </button>
        </div>

        <div className="command-actions">
          <span className="mode-dot">Demo mode</span>
          <button className="quiet-action" onClick={loadDemo} type="button">
            <Sparkles size={15} />
            Reset
          </button>
          <button className="run-action" disabled={isBusy || !target.trim()} onClick={runSprint} type="button">
            {loading === "sprint" ? <Loader2 className="spin" size={16} /> : <Radar size={16} />}
            Run sprint
          </button>
        </div>
      </header>

      <div className="notice-line" role="status">
        <Check size={15} />
        {notice}
      </div>

      <div className="workspace-grid">
        <ProgressRail activeStep={activeStep} />

        <div className="main-canvas">
          <ProfileBlock
            loading={loading === "parse"}
            parsedProfile={parsedProfile}
            profileText={profileText}
            onParse={parseProfile}
            onProfileChange={setProfileText}
          />

          <PeopleBoard people={people} selectedPath={selectedPath} onSelectPerson={selectPerson} />
        </div>

        <BestPathPane
          outcomes={outcomes}
          ranking={loading === "rank"}
          selectedPath={selectedPath}
          onOutcome={updateOutcome}
          onRank={() => rankPaths()}
        />
      </div>

      <DraftComposer
        draft={draft}
        generating={loading === "draft"}
        selectedPath={selectedPath}
        onCopy={copyDraft}
        onGenerate={() => generateDraft()}
      />
    </main>
  );
}
