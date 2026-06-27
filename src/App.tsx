import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Briefcase,
  Building2,
  Check,
  Clipboard,
  ExternalLink,
  FileText,
  Loader2,
  MapPin,
  MessageSquare,
  Network,
  Radar,
  Target,
  Users,
  X
} from "lucide-react";
import { api } from "./lib/api";
import type {
  ContactType,
  DiscoveredPerson,
  JobOpportunity,
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

const contactLabels: Record<ContactType, string> = {
  hiring_manager: "Hiring manager",
  mentor: "Mentor",
  colleague: "Role colleague"
};

const outcomeOptions = Object.keys(outcomeLabels) as OutcomeState[];
const contactGroups: Array<{ type: ContactType; title: string }> = [
  { type: "hiring_manager", title: "Hiring managers" },
  { type: "mentor", title: "Mentors" },
  { type: "colleague", title: "Colleagues in the role" }
];

function readOutcomes(): Record<string, OutcomeState> {
  try {
    return JSON.parse(localStorage.getItem("zo.relationship.outcomes") || "{}") as Record<string, OutcomeState>;
  } catch {
    return {};
  }
}

function toStringArray(items: unknown) {
  if (Array.isArray(items)) return items.map((item) => String(item).trim()).filter(Boolean);
  if (typeof items === "string" && items.trim()) return [items.trim()];
  return [];
}

function shortList(items: unknown, max = 4) {
  const list = toStringArray(items);
  if (!list.length) return "No signals yet";
  const visible = list.slice(0, max).join(", ");
  return list.length > max ? `${visible} +${list.length - max}` : visible;
}

function apiStatus(reason?: string) {
  return reason ? reason.replace(/\.$/, "") : "Live signal complete";
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong.";
}

function ProgressRail({ activeStep }: { activeStep: number }) {
  const steps = [
    { icon: FileText, label: "Profile" },
    { icon: Briefcase, label: "Jobs" },
    { icon: Users, label: "People" },
    { icon: Network, label: "Path" },
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
      <div className="section-kicker">Resume / profile</div>
      <textarea
        aria-label="Career profile or resume"
        placeholder="Paste resume, LinkedIn summary, or operator profile"
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
        <div className="empty-state">Awaiting profile.</div>
      )}
    </section>
  );
}

function JobBoard({
  jobs,
  selectedJob,
  loading,
  onSelectJob
}: {
  jobs: JobOpportunity[];
  selectedJob: JobOpportunity | null;
  loading: boolean;
  onSelectJob: (jobId: string) => void;
}) {
  return (
    <section className="job-board">
      <div className="section-head">
        <div>
          <div className="section-kicker">Ranked jobs</div>
          <h2>{jobs.length ? `${jobs.length} live opportunities` : "No jobs ranked yet"}</h2>
        </div>
        <Briefcase size={18} />
      </div>

      <div className="job-list">
        {jobs.length ? (
          jobs.map((job, index) => (
            <article className={`job-line ${selectedJob?.id === job.id ? "selected" : ""}`} key={job.id}>
              <button disabled={loading} onClick={() => onSelectJob(job.id)} type="button">
                <span className="job-rank">#{index + 1}</span>
                <span className="job-score">{job.fitScore}</span>
                <span className="job-copy">
                  <strong>{job.title}</strong>
                  <small>
                    <Building2 size={13} />
                    {job.company}
                  </small>
                  <small>
                    <MapPin size={13} />
                    {job.location}
                  </small>
                </span>
                <span className="job-reason">{job.whyThisJob}</span>
              </button>
              <div className="job-footer">
                <span>{loading && selectedJob?.id === job.id ? "Finding contacts..." : shortList(job.matchSignals, 3)}</span>
                <a href={job.url} rel="noreferrer" target="_blank" aria-label={`Open ${job.title}`}>
                  <ExternalLink size={14} />
                </a>
              </div>
            </article>
          ))
        ) : (
          <div className="empty-state">Find jobs from the parsed profile.</div>
        )}
      </div>
    </section>
  );
}

function OpportunityDrawer({
  people,
  selectedPath,
  selectedJob,
  loading,
  outcomes,
  ranking,
  generating,
  draft,
  onSelectPerson,
  onRank,
  onOutcome,
  onGenerate,
  onCopy,
  onClose
}: {
  people: DiscoveredPerson[];
  selectedPath: TrustPath | null;
  selectedJob: JobOpportunity;
  loading: boolean;
  outcomes: Record<string, OutcomeState>;
  ranking: boolean;
  generating: boolean;
  draft: OutreachDraft | null;
  onSelectPerson: (personName: string) => void;
  onRank: () => void;
  onOutcome: (pathId: string, outcome: OutcomeState) => void;
  onGenerate: () => void;
  onCopy: () => void;
  onClose: () => void;
}) {
  const groupedPeople = contactGroups.map((group) => ({
    ...group,
    people: people.filter((person) => person.contactType === group.type)
  }));
  const riskText = selectedPath?.risks[0]?.trim() || "No explicit risk returned for this path.";

  return (
    <div className="opportunity-overlay" role="presentation" onClick={onClose}>
      <aside className="opportunity-drawer" aria-label={`Opportunity details for ${selectedJob.company}`} onClick={(event) => event.stopPropagation()}>
        <header className="drawer-head">
          <div>
            <div className="section-kicker">Selected opportunity</div>
            <h2>{selectedJob.title}</h2>
            <p>{selectedJob.company} · {selectedJob.location}</p>
          </div>
          <button className="icon-button" aria-label="Close opportunity details" onClick={onClose} type="button">
            <X size={18} />
          </button>
        </header>

        <section className="drawer-section">
          <div className="drawer-section-head">
            <div>
              <div className="section-kicker">People to talk to</div>
              <h3>{loading ? "Finding contacts" : `${people.length} live contacts`}</h3>
            </div>
            {loading ? <Loader2 className="spin" size={18} /> : <Users size={18} />}
          </div>

          <div className="people-groups drawer-groups">
            {loading ? (
              <div className="empty-state">Finding hiring managers, mentors, and role colleagues.</div>
            ) : people.length ? (
              groupedPeople.map((group) => (
                <section className="contact-group" key={group.type}>
                  <div className="contact-group-head">
                    <span>{group.title}</span>
                    <strong>{group.people.length}</strong>
                  </div>
                  <div className="contact-list">
                    {group.people.length ? (
                      group.people.map((person) => (
                        <button
                          className={`person-card ${selectedPath?.personName === person.name ? "selected" : ""}`}
                          key={person.id}
                          onClick={() => onSelectPerson(person.name)}
                          type="button"
                        >
                          <span className="identity">
                            <strong>{person.name}</strong>
                            <small>{person.title}</small>
                          </span>
                          <span className="signals">{person.whyTalk || shortList(person.signals, 2)}</span>
                          <a href={person.url} onClick={(event) => event.stopPropagation()} rel="noreferrer" target="_blank">
                            <ExternalLink size={14} />
                          </a>
                        </button>
                      ))
                    ) : (
                      <div className="contact-empty">No public match returned.</div>
                    )}
                  </div>
                </section>
              ))
            ) : (
              <div className="empty-state">No public contacts found for this opportunity.</div>
            )}
          </div>
        </section>

        <section className="drawer-section">
          <div className="drawer-section-head">
            <div>
              <div className="section-kicker">Best contact</div>
              <h3>{selectedPath ? selectedPath.personName : "Rank after contacts load"}</h3>
            </div>
            <button className="ghost-button" disabled={!people.length || ranking || loading} onClick={onRank} type="button">
              {ranking ? <Loader2 className="spin" size={15} /> : <Network size={15} />}
              Rank
            </button>
          </div>

          {selectedPath ? (
            <>
              <div className="compact-score">
                <span>{selectedPath.score}</span>
                <div>
                  <strong>{selectedPath.role}</strong>
                  <small>{selectedPath.company}</small>
                </div>
              </div>

              <div className="reason-stack compact-reasons">
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
                  <p>{riskText}</p>
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
            <div className="empty-state">Rank contacts after people discovery.</div>
          )}
        </section>

        <section className="drawer-section">
          <div className="drawer-section-head">
            <div>
              <div className="section-kicker">Outreach draft</div>
              <h3>{selectedPath ? `Message for ${selectedPath.personName}` : "Pick the best contact first"}</h3>
            </div>
            <button className="ghost-button" disabled={!selectedPath || generating} onClick={onGenerate} type="button">
              {generating ? <Loader2 className="spin" size={15} /> : <MessageSquare size={15} />}
              Generate
            </button>
          </div>

          {draft ? (
            <div className="drawer-draft">
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
            <div className="empty-state">Generate after a contact is ranked.</div>
          )}
        </section>
      </aside>
    </div>
  );
}

export default function App() {
  const [profileText, setProfileText] = useState("");
  const [searchFocus, setSearchFocus] = useState("");
  const [parsedProfile, setParsedProfile] = useState<ParsedProfile | null>(null);
  const [jobs, setJobs] = useState<JobOpportunity[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [people, setPeople] = useState<DiscoveredPerson[]>([]);
  const [paths, setPaths] = useState<TrustPath[]>([]);
  const [selectedPathId, setSelectedPathId] = useState<string | null>(null);
  const [draft, setDraft] = useState<OutreachDraft | null>(null);
  const [outcomes, setOutcomes] = useState<Record<string, OutcomeState>>(readOutcomes);
  const [notice, setNotice] = useState("Paste a real profile, then find live jobs.");
  const [loading, setLoading] = useState<"idle" | "parse" | "jobs" | "people" | "rank" | "draft" | "sprint">("idle");

  useEffect(() => {
    localStorage.setItem("zo.relationship.outcomes", JSON.stringify(outcomes));
  }, [outcomes]);

  const selectedJob = useMemo(
    () => jobs.find((job) => job.id === selectedJobId) ?? null,
    [jobs, selectedJobId]
  );

  const selectedPath = useMemo(
    () => paths.find((path) => path.id === selectedPathId) ?? paths[0] ?? null,
    [paths, selectedPathId]
  );

  const activeStep = draft ? 4 : paths.length ? 3 : selectedJob ? 2 : jobs.length ? 1 : 0;
  const isBusy = loading !== "idle";

  function resetDownstream() {
    setPeople([]);
    setPaths([]);
    setSelectedPathId(null);
    setDraft(null);
  }

  async function parseProfile() {
    setLoading("parse");
    try {
      const result = await api.parseProfile({ profileText });
      setParsedProfile(result.data);
      setNotice(`Profile parsed. ${apiStatus(result.reason)}`);
      return result.data;
    } catch (error) {
      setNotice(`Profile parse failed: ${errorMessage(error)}`);
      return null;
    } finally {
      setLoading("idle");
    }
  }

  async function findJobsFromProfile() {
    if (!profileText.trim()) {
      setNotice("Paste a real profile before finding jobs.");
      return [];
    }

    setLoading("jobs");
    try {
      let profile = parsedProfile;
      if (!profile) {
        setNotice("Parsing profile with OpenAI...");
        const parsed = await api.parseProfile({ profileText });
        profile = parsed.data;
        setParsedProfile(profile);
      }

      setNotice("Searching and ranking live jobs with Exa and OpenAI...");
      const result = await api.discoverJobs({ parsedProfile: profile, searchFocus });
      setJobs(result.data.jobs);
      setSelectedJobId(null);
      resetDownstream();
      setNotice(
        result.data.jobs.length
          ? `Jobs ranked best to worst. Select an opportunity to find contacts. ${apiStatus(result.reason)}`
          : "Live search completed, but no public jobs were returned."
      );
      return result.data.jobs;
    } catch (error) {
      setNotice(`Job discovery failed: ${errorMessage(error)}`);
      return [];
    } finally {
      setLoading("idle");
    }
  }

  async function discoverPeople(job = selectedJob, profile = parsedProfile) {
    if (!profile) {
      setNotice("Parse a real profile before discovering people.");
      return [];
    }
    if (!job) {
      setNotice("Select a ranked job before discovering people.");
      return [];
    }

    setLoading("people");
    try {
      const result = await api.discoverPeople({ selectedJob: job, parsedProfile: profile });
      setPeople(result.data.results);
      setPaths([]);
      setSelectedPathId(null);
      setDraft(null);
      setNotice(
        result.data.results.length
          ? `People discovery complete. ${apiStatus(result.reason)}`
          : `No public contacts found around ${job.company}.`
      );
      return result.data.results;
    } catch (error) {
      setNotice(`People discovery failed: ${errorMessage(error)}`);
      return [];
    } finally {
      setLoading("idle");
    }
  }

  async function rankPaths(profile = parsedProfile, discovered = people, job = selectedJob) {
    if (!profile || !job || !discovered.length) {
      setNotice("Discover people for a selected job before ranking contacts.");
      return [];
    }

    setLoading("rank");
    try {
      const result = await api.rankTrustPaths({ selectedJob: job, parsedProfile: profile, discoveredPeople: discovered });
      setPaths(result.data.paths);
      setSelectedPathId(result.data.paths[0]?.id ?? null);
      setDraft(null);
      setNotice(`Contacts ranked. ${apiStatus(result.reason)}`);
      return result.data.paths;
    } catch (error) {
      setNotice(`Ranking failed: ${errorMessage(error)}`);
      return [];
    } finally {
      setLoading("idle");
    }
  }

  async function generateDraft(path = selectedPath, job = selectedJob) {
    if (!path || !job) return null;
    setLoading("draft");
    try {
      const result = await api.draftOutreach({
        selectedJob: job,
        parsedProfile: parsedProfile ?? undefined,
        selectedPath: path,
        tone: "warm, concise, non-desperate"
      });
      setDraft(result.data);
      setNotice(`Draft ready. ${apiStatus(result.reason)}`);
      return result.data;
    } catch (error) {
      setNotice(`Drafting failed: ${errorMessage(error)}`);
      return null;
    } finally {
      setLoading("idle");
    }
  }

  async function runSprint() {
    if (!profileText.trim()) {
      setNotice("Paste a real profile before running a sprint.");
      return;
    }

    setLoading("sprint");
    try {
      setNotice("Live sprint running: parsing profile with OpenAI...");
      const parsed = await api.parseProfile({ profileText });
      setParsedProfile(parsed.data);

      setNotice("Live sprint running: finding and ranking jobs...");
      const discoveredJobs = await api.discoverJobs({ parsedProfile: parsed.data, searchFocus });
      setJobs(discoveredJobs.data.jobs);
      setSelectedJobId(null);
      resetDownstream();

      if (!discoveredJobs.data.jobs.length) {
        setNotice("Live job search completed, but no public jobs were returned.");
        return;
      }

      setNotice("Jobs ranked best to worst. Select an opportunity to find contacts.");
    } catch (error) {
      setNotice(`Live sprint failed: ${errorMessage(error)}`);
    } finally {
      setLoading("idle");
    }
  }

  function selectJob(jobId: string) {
    const job = jobs.find((item) => item.id === jobId) ?? null;
    setSelectedJobId(jobId);
    resetDownstream();
    if (job) {
      setNotice(`${job.company} selected. Finding contacts for this opportunity...`);
      void discoverPeople(job, parsedProfile);
    }
  }

  function closeOpportunity() {
    setSelectedJobId(null);
    resetDownstream();
    setNotice("Opportunity closed. Select another ranked job to inspect contacts.");
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
            <small>Job Path Sprint</small>
          </div>
        </div>

        <div className="target-command">
          <Target size={16} />
          <input
            aria-label="Job search focus"
            value={searchFocus}
            onChange={(event) => setSearchFocus(event.target.value)}
            placeholder="Optional: AI agent roles in Singapore climate tech"
          />
          <button disabled={loading === "jobs" || isBusy || !profileText.trim()} onClick={findJobsFromProfile} type="button">
            {loading === "jobs" ? <Loader2 className="spin" size={16} /> : <ArrowRight size={16} />}
            Find jobs
          </button>
        </div>

        <div className="command-actions">
          <span className="mode-dot">Live mode</span>
          <button className="run-action" disabled={isBusy || !profileText.trim()} onClick={runSprint} type="button">
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

          <JobBoard
            jobs={jobs}
            loading={loading === "people"}
            selectedJob={selectedJob}
            onSelectJob={selectJob}
          />
        </div>
      </div>

      {selectedJob ? (
        <OpportunityDrawer
          draft={draft}
          generating={loading === "draft"}
          loading={loading === "people"}
          outcomes={outcomes}
          people={people}
          ranking={loading === "rank"}
          selectedJob={selectedJob}
          selectedPath={selectedPath}
          onClose={closeOpportunity}
          onCopy={copyDraft}
          onGenerate={() => generateDraft()}
          onOutcome={updateOutcome}
          onRank={() => rankPaths()}
          onSelectPerson={selectPerson}
        />
      ) : null}
    </main>
  );
}
