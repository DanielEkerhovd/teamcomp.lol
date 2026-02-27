import { useState } from "react";
import { Region, REGIONS } from "../../types";
import { useSettingsStore } from "../../stores/useSettingsStore";

// Group regions by geography for better UX
const REGION_GROUPS = [
  {
    label: "Europe",
    regions: ["euw", "eune", "tr", "ru"] as Region[],
  },
  {
    label: "Americas",
    regions: ["na", "br", "lan", "las"] as Region[],
  },
  {
    label: "Asia Pacific",
    regions: ["kr", "jp", "oce", "ph", "sg", "th", "tw", "vn"] as Region[],
  },
];

export default function FirstTimeSetupModal() {
  const {
    defaultRegion,
    setDefaultRegion,
    hasCompletedOnboarding,
    completeOnboarding,
  } = useSettingsStore();
  const [selectedRegion, setSelectedRegion] = useState<Region>(defaultRegion);

  if (hasCompletedOnboarding) return null;

  const handleGetStarted = () => {
    setDefaultRegion(selectedRegion);
    completeOnboarding();
  };

  const getRegionLabel = (region: Region) => {
    return REGIONS.find((r) => r.value === region)?.label || region;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-2xl mx-4 bg-lol-card border border-lol-border rounded-2xl shadow-2xl shadow-black/50">
        {/* Header */}
        <div className="px-8 pt-8 pb-4 flex items-center justify-center gap-10">
          <div className="">
            <img
              src="/images/logo.png"
              alt="Teamcomp logo"
              className="size-20"
            />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white mb-2">
              Welcome to teamcomp.<span className="text-lol-gold">lol</span>
            </h1>
            <p className="text-gray-400">
              Select your default server region to get started
            </p>
          </div>
        </div>

        {/* Region Selection */}
        <div className="px-8 py-6 space-y-6">
          {REGION_GROUPS.map((group) => (
            <div key={group.label}>
              <h3 className="text-sm font-medium text-gray-400 mb-3">
                {group.label}
              </h3>
              <div className="grid grid-cols-4 gap-2">
                {group.regions.map((region) => (
                  <button
                    key={region}
                    onClick={() => setSelectedRegion(region)}
                    className={`px-3 py-3 rounded-xl border text-sm font-medium transition-all duration-200 ${
                      selectedRegion === region
                        ? "bg-lol-gold/20 border-lol-gold text-lol-gold"
                        : "bg-lol-surface border-lol-border text-gray-300 hover:border-gray-500 hover:text-white"
                    }`}
                  >
                    <div className="font-semibold">{region.toUpperCase()}</div>
                    <div
                      className={`text-xs mt-0.5 ${selectedRegion === region ? "text-lol-gold/70" : "text-gray-500"}`}
                    >
                      {getRegionLabel(region)}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-8 pb-8 pt-2">
          <button
            onClick={handleGetStarted}
            className="w-full py-3 px-6 bg-gradient-to-r from-lol-gold-light to-lol-gold text-lol-dark font-semibold rounded-xl hover:shadow-lg hover:shadow-lol-gold/20 transition-all duration-200"
          >
            Get Started
          </button>
          <p className="text-center text-xs text-gray-500 mt-4">
            You can change this anytime in Settings
          </p>
        </div>
      </div>
    </div>
  );
}
