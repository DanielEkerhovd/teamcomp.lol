import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Modal from "../ui/Modal";
import Input from "../ui/Input";
import Button from "../ui/Button";
import ButtonGroup from "../ui/ButtonGroup";
import { liveDraftService } from "../../lib/liveDraftService";
import type { DraftMode } from "../../types/liveDraft";

interface CreateSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const DRAFT_MODE_OPTIONS = [
  { value: "normal", label: "Normal" },
  { value: "fearless", label: "Fearless" },
  { value: "ironman", label: "Ironman" },
];

const TIMER_OPTIONS = [
  { value: "15", label: "15s" },
  { value: "30", label: "30s", sublabel: "default" },
  { value: "45", label: "45s" },
  { value: "60", label: "60s" },
  { value: "90", label: "90s" },
];

export default function CreateSessionModal({
  isOpen,
  onClose,
}: CreateSessionModalProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  // Form state
  const [sessionName, setSessionName] = useState("");
  const [team1Name, setTeam1Name] = useState("");
  const [team2Name, setTeam2Name] = useState("");
  const [draftMode, setDraftMode] = useState<DraftMode>("fearless");
  const [plannedGames, setPlannedGames] = useState(3);
  const [pickTime, setPickTime] = useState(30);
  const [banTime, setBanTime] = useState(30);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const session = await liveDraftService.createSession({
        name: sessionName || "Live Draft",
        draftMode,
        plannedGames,
        pickTimeSeconds: pickTime,
        banTimeSeconds: banTime,
        team1Name: team1Name || undefined,
        team2Name: team2Name || undefined,
      });

      // Navigate to lobby page
      navigate(`/live-draft/${session.id}`);
      onClose();
    } catch (err) {
      console.error("Failed to create session:", err);
      setError(err instanceof Error ? err.message : "Failed to create session");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSessionName("");
    setTeam1Name("");
    setTeam2Name("");
    setDraftMode("fearless");
    setPlannedGames(3);
    setPickTime(30);
    setBanTime(30);
    setShowSettings(false);
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Create Live Draft"
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Error message */}
        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Session Name */}
        <Input
          label="Session Name"
          value={sessionName}
          onChange={(e) => setSessionName(e.target.value)}
          placeholder="e.g., Scrimmage vs Team Alpha"
          maxLength={30}
        />

        {/* Team Names */}
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Team 1"
            value={team1Name}
            onChange={(e) => setTeam1Name(e.target.value)}
            placeholder="Team 1"
            maxLength={30}
          />
          <Input
            label="Team 2"
            value={team2Name}
            onChange={(e) => setTeam2Name(e.target.value)}
            placeholder="Team 2"
            maxLength={30}
          />
        </div>
        <p className="text-xs text-gray-500 -mt-4">
          Team and side selection happens in the lobby
        </p>

        {/* Draft Mode */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-300">
            Draft Mode
          </label>
          <div className="grid grid-cols-3 gap-2">
            {DRAFT_MODE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setDraftMode(option.value as DraftMode)}
                className={`
                  px-4 py-3 rounded-xl text-sm font-medium transition-colors border-2
                  ${
                    draftMode === option.value
                      ? "bg-lol-gold/20 border-lol-gold text-lol-gold"
                      : "bg-lol-surface border-lol-border text-gray-400 hover:border-lol-border-light hover:text-white"
                  }
                `}
              >
                {option.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {draftMode === "normal" &&
              "Standard draft rules. Champions can be reused each game."}
            {draftMode === "fearless" &&
              "Champions can't be picked by the same team again in the series."}
            {draftMode === "ironman" &&
              "Once a champion is picked or banned, they are unavailable for the rest of the series."}
          </p>
        </div>

        {/* Number of Games */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-300">
            Number of Games
          </label>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => setPlannedGames(num)}
                className={`
                  w-10 h-10 rounded-lg text-sm font-medium transition-colors border-2
                  ${
                    plannedGames === num
                      ? "bg-lol-gold/20 border-lol-gold text-lol-gold"
                      : "bg-lol-surface border-lol-border text-gray-400 hover:border-lol-border-light hover:text-white"
                  }
                `}
              >
                {num}
              </button>
            ))}
          </div>
        </div>

        {/* Settings Toggle */}
        <button
          type="button"
          onClick={() => setShowSettings(!showSettings)}
          className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
        >
          <svg
            className={`w-4 h-4 transition-transform ${showSettings ? "rotate-90" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          Timer Settings
          <span className="text-gray-500">
            ({pickTime}s / {banTime}s)
          </span>
        </button>

        {/* Timer Settings (collapsible) */}
        {showSettings && (
          <div className="space-y-4 pl-6 border-l-2 border-lol-border">
            <ButtonGroup
              label="Pick Timer"
              options={TIMER_OPTIONS}
              value={pickTime.toString()}
              onChange={(value) => setPickTime(parseInt(value, 10))}
              size="sm"
            />
            <ButtonGroup
              label="Ban Timer"
              options={TIMER_OPTIONS}
              value={banTime.toString()}
              onChange={(value) => setBanTime(parseInt(value, 10))}
              size="sm"
            />
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <Button
            type="button"
            variant="secondary"
            onClick={handleClose}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button type="submit" disabled={loading} className="flex-1">
            {loading ? (
              <span className="flex items-center gap-2">
                <svg
                  className="animate-spin h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Creating...
              </span>
            ) : (
              "Create Session"
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
