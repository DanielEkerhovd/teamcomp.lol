import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useAuthStore } from "../stores/useAuthStore";
import {
  createCheckoutSession,
  createPortalSession,
  STRIPE_PRICES,
  isStripeConfigured,
} from "../lib/stripeService";
import { supabase } from "../lib/supabase";
import type { DbSubscription } from "../types/database";
import LoginModal from "../components/auth/LoginModal";

// Tier level for comparison (higher = better)
function tierLevel(tier?: string): number {
  switch (tier) {
    case "paid":
      return 1;
    case "beta":
      return 1;
    case "supporter":
      return 2;
    case "admin":
      return 3;
    case "developer":
      return 3;
    default:
      return 0; // free
  }
}

export default function UpgradePage() {
  const { user, profile, refreshProfile } = useAuthStore();
  const location = useLocation();

  const [checkingOutPlan, setCheckingOutPlan] = useState<
    "pro" | "supporter" | null
  >(null);
  const [planError, setPlanError] = useState<string | null>(null);
  const [planSuccess, setPlanSuccess] = useState<string | null>(null);
  const [activeSubscription, setActiveSubscription] =
    useState<DbSubscription | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);

  const currentLevel = tierLevel(profile?.tier);

  // Handle checkout return URLs
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const checkoutParam = params.get("checkout");

    if (checkoutParam === "success") {
      setPlanSuccess(
        "Your subscription is being activated. It may take a moment to reflect.",
      );
      refreshProfile();
      const url = new URL(window.location.href);
      url.searchParams.delete("checkout");
      window.history.replaceState({}, "", url.toString());
    } else if (checkoutParam === "cancelled") {
      setPlanError("Checkout was cancelled.");
      const url = new URL(window.location.href);
      url.searchParams.delete("checkout");
      window.history.replaceState({}, "", url.toString());
    }
  }, [location.search, refreshProfile]);

  // Fetch active subscription
  useEffect(() => {
    if (!isStripeConfigured || !supabase || !user) return;
    supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .in("status", ["active", "past_due", "trialing"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        setActiveSubscription(data);
      });
  }, [user, profile?.tier]);

  const handleCheckout = async (plan: "pro" | "supporter") => {
    setCheckingOutPlan(plan);
    setPlanError(null);
    setPlanSuccess(null);
    const result = await createCheckoutSession({
      mode: "subscription",
      priceId: STRIPE_PRICES[plan],
    });
    if (result.error) {
      setPlanError(result.error);
      setCheckingOutPlan(null);
    }
  };

  const handleManageSubscription = async () => {
    setPlanError(null);
    const result = await createPortalSession();
    if (result.error) {
      setPlanError(result.error);
    }
  };

  // Check icon helper
  const CheckIcon = ({
    className = "text-green-500",
  }: {
    className?: string;
  }) => (
    <svg
      className={`w-4 h-4 shrink-0 ${className}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M5 13l4 4L19 7"
      />
    </svg>
  );

  const isProGrayed = currentLevel >= 1;
  const isSupporterGrayed = currentLevel >= 2;

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">
            Plans & Pricing
          </h1>
          <p className="text-gray-400">
            Choose the plan that fits your team's needs.
          </p>
        </div>
        {user && profile && (
          <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-lol-card border border-lol-border">
            <span className="text-sm text-gray-400">Your plan:</span>
            <span
              className={`px-3 py-1 text-sm font-bold rounded-full ${
                profile.tier === "paid"
                  ? "bg-lol-gold/20 text-lol-gold"
                  : profile.tier === "beta"
                    ? "bg-blue-500/20 text-blue-400"
                    : profile.tier === "supporter"
                      ? "bg-purple-500/20 text-purple-400"
                      : profile.tier === "admin"
                        ? "bg-red-500/20 text-red-400"
                        : profile.tier === "developer"
                          ? "bg-emerald-500/20 text-emerald-400"
                          : "bg-gray-500/20 text-gray-400"
              }`}
            >
              {profile.tier === "paid"
                ? "Pro"
                : profile.tier === "beta"
                  ? "Beta"
                  : profile.tier === "supporter"
                    ? "Supporter"
                    : profile.tier === "admin"
                      ? "Admin"
                      : profile.tier === "developer"
                        ? "Developer"
                        : "Free"}
            </span>
          </div>
        )}
      </div>

      {/* Plan checkout feedback */}
      {planSuccess && (
        <div className="mb-4 p-3 rounded-lg bg-green-500/10 border border-green-500/30 text-green-400 text-sm">
          {planSuccess}
        </div>
      )}
      {planError && (
        <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          {planError}
        </div>
      )}

      {/* Stripe not configured warning */}
      {!isStripeConfigured && (
        <div className="mb-6 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm text-center">
          Subscriptions are not available during the beta period.
        </div>
      )}

      {/* Plan cards grid */}
      <div
        className={`grid grid-cols-3 gap-4 mb-6 ${!isStripeConfigured ? "opacity-60 pointer-events-none" : ""}`}
      >
        {/* Current plan card */}
        {user && profile && (
          <div
            className={`col-span-3 p-6 rounded-2xl border-2 flex flex-col justify-center gap-8 ${
              profile.tier === "paid"
                ? "border-lol-gold/30 bg-linear-to-br from-lol-gold/10 via-lol-gold/5 to-transparent"
                : profile.tier === "beta"
                  ? "border-blue-500/30 bg-linear-to-br from-blue-500/10 via-blue-500/5 to-transparent"
                  : profile.tier === "supporter"
                    ? "border-purple-500/30 bg-linear-to-br from-purple-500/10 via-purple-500/5 to-transparent"
                    : profile.tier === "admin"
                      ? "border-red-500/30 bg-linear-to-br from-red-500/10 via-red-500/5 to-transparent"
                      : profile.tier === "developer"
                        ? "border-emerald-500/30 bg-linear-to-br from-emerald-500/10 via-emerald-500/5 to-transparent"
                        : "border-gray-500/30 bg-linear-to-br from-gray-500/10 via-gray-500/5 to-transparent"
            }`}
          >
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <span
                  className={`px-3 py-1 text-sm font-bold rounded-full ${
                    profile.tier === "paid"
                      ? "bg-lol-gold/20 text-lol-gold"
                      : profile.tier === "beta"
                        ? "bg-blue-500/20 text-blue-400"
                        : profile.tier === "supporter"
                          ? "bg-purple-500/20 text-purple-400"
                          : profile.tier === "admin"
                            ? "bg-red-500/20 text-red-400"
                            : profile.tier === "developer"
                              ? "bg-emerald-500/20 text-emerald-400"
                              : "bg-gray-500/20 text-gray-400"
                  }`}
                >
                  {profile.tier === "paid"
                    ? "Pro"
                    : profile.tier === "beta"
                      ? "Beta"
                      : profile.tier === "supporter"
                        ? "Supporter"
                        : profile.tier === "admin"
                          ? "Admin"
                          : profile.tier === "developer"
                            ? "Developer"
                            : "Free"}
                </span>
                <span className="text-white font-semibold text-lg">
                  Your Current Plan
                </span>
              </div>
              {activeSubscription &&
                (profile.tier === "paid" || profile.tier === "supporter") && (
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-400">
                      {activeSubscription.cancel_at_period_end
                        ? `Cancels ${new Date(activeSubscription.current_period_end!).toLocaleDateString()}`
                        : `Renews ${new Date(activeSubscription.current_period_end!).toLocaleDateString()}`}
                    </span>
                    <button
                      onClick={handleManageSubscription}
                      className="text-sm text-lol-gold hover:text-lol-gold-light transition-colors font-medium"
                    >
                      Manage
                    </button>
                  </div>
                )}
            </div>

            <ul className="flex flex-col gap-y-2 text-sm text-gray-300">
              {profile.tier === "free" && (
                <>
                  <li className="flex items-center gap-2">
                    <CheckIcon />
                    <span>Manage 1 team</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckIcon />
                    <span>10 enemy teams</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckIcon />
                    <span>20 planned drafts</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckIcon />
                    <span>Cloud sync</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckIcon />
                    <span>Community access</span>
                  </li>
                </>
              )}
              {(profile.tier === "paid" ||
                profile.tier === "beta" ||
                profile.tier === "supporter" ||
                profile.tier === "admin") && (
                <>
                  {profile.tier === "beta" && (
                    <li className="flex items-center gap-2">
                      <svg
                        className="w-4 h-4 text-blue-400 shrink-0"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                        />
                      </svg>
                      <span>Beta tester discord role</span>
                    </li>
                  )}
                  <li className="flex items-center gap-2">
                    <CheckIcon />
                    <span>
                      {profile.tier === "admin"
                        ? "Unlimited teams"
                        : `Manage up to ${profile.maxTeams ?? 3} teams`}
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckIcon />
                    <span>
                      {profile.tier === "admin"
                        ? "Unlimited enemy teams"
                        : `Up to ${profile.maxEnemyTeams ?? 30} enemy teams`}
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckIcon />
                    <span>
                      {profile.tier === "admin"
                        ? "Unlimited drafts"
                        : `Up to ${profile.maxDrafts ?? 300} planned drafts`}
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckIcon />
                    <span>More profile customization</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckIcon />
                    <span>Cloud sync</span>
                  </li>
                </>
              )}
              {(profile.tier === "supporter" || profile.tier === "admin") && (
                <>
                  <li className="flex items-center gap-2">
                    <svg
                      className="w-4 h-4 text-purple-400 shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                      />
                    </svg>
                    <span>Supporting development</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckIcon />
                    <span>Early access to new features</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckIcon />
                    <span>Supporter badge</span>
                  </li>
                </>
              )}
              {profile.tier === "developer" && (
                <>
                  <li className="flex items-center gap-2">
                    <CheckIcon className="text-emerald-400" />
                    <span>You built this thing</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckIcon className="text-emerald-400" />
                    <span>Unlimited everything (obviously)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckIcon className="text-emerald-400" />
                    <span>Access to features before they exist</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckIcon className="text-emerald-400" />
                    <span>Free tier (you're paying in tears)</span>
                  </li>
                </>
              )}
            </ul>
          </div>
        )}
        {/* Free Tier */}
        <div
          className={`p-5 rounded-xl border flex flex-col ${
            currentLevel === 0 && user
              ? "border-gray-500/40 bg-lol-surface/30"
              : currentLevel > 0
                ? "border-lol-border bg-lol-surface/20 opacity-50"
                : "border-lol-border bg-lol-surface/30"
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-gray-300 font-semibold text-sm px-2.5 py-0.5 rounded-full bg-gray-500/20">
              Free
            </h4>
            <span className="text-gray-400 font-medium">€0</span>
          </div>
          <ul className="space-y-2 text-sm text-gray-300 flex-1">
            <li className="flex items-center gap-2">
              <CheckIcon />
              <span>Manage 1 team</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckIcon />
              <span>10 enemy teams</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckIcon />
              <span>20 planned drafts</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckIcon />
              <span>Cloud sync</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckIcon />
              <span>Community access</span>
            </li>
          </ul>
          <div className="mt-10 py-2 text-center text-sm text-gray-500 font-medium">
            {currentLevel === 0 && user
              ? "Your current plan"
              : currentLevel > 0
                ? "Included"
                : ""}
          </div>
        </div>

        {/* Pro Tier */}
        <div
          className={`p-5 rounded-xl border flex flex-col ${
            isProGrayed
              ? "border-lol-border bg-lol-surface/20 opacity-50"
              : "border-lol-border bg-lol-surface/30 hover:border-lol-gold/30 transition-colors"
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-lol-gold font-semibold text-sm px-2.5 py-0.5 rounded-full bg-lol-gold/20">
              Pro
            </h4>
            <span className="text-lol-gold font-medium">€3/month</span>
          </div>
          <ul className="space-y-2 text-sm text-gray-300 flex-1">
            <li className="flex items-center gap-2">
              <CheckIcon />
              <span className="text-white">Everything in Free, plus:</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckIcon />
              <span className="text-white font-medium">Up to 300 drafts</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckIcon />
              <span className="text-white">Manage up to 3 teams</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckIcon />
              <span className="text-white">Up to 30 enemy teams</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckIcon />
              <span className="text-white">More profile customization</span>
            </li>
          </ul>
          {isProGrayed ? (
            <div className="mt-10 py-2 text-center text-sm text-gray-500 font-medium">
              {currentLevel === 1
                ? "Your current plan"
                : "Included in your plan"}
            </div>
          ) : (
            <button
              onClick={() =>
                user ? handleCheckout("pro") : setShowLoginModal(true)
              }
              disabled={checkingOutPlan !== null}
              className="w-full py-2 mt-10 bg-lol-gold text-lol-dark font-medium rounded-lg hover:bg-lol-gold-light transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {checkingOutPlan === "pro" ? "Redirecting..." : "Upgrade to Pro"}
            </button>
          )}
        </div>

        {/* Supporter Tier */}
        <div
          className={`p-5 rounded-xl border relative overflow-hidden flex flex-col ${
            isSupporterGrayed
              ? "border-lol-border bg-lol-surface/20 opacity-50"
              : "border-purple-500/30 bg-lol-surface/30 hover:border-purple-500/50 transition-colors"
          }`}
        >
          <div className="absolute top-0 right-0 px-3 py-1 bg-purple-500/20 text-purple-400 text-xs font-medium rounded-bl-lg">
            Support us
          </div>
          <div className="flex items-center justify-between mb-3 mt-2">
            <h4 className="text-purple-400 font-semibold text-sm px-2.5 py-0.5 rounded-full bg-purple-500/20">
              Supporter
            </h4>
            <span className="text-purple-400 font-medium">€10/month</span>
          </div>
          <ul className="space-y-2 text-sm text-gray-300 flex-1">
            <li className="flex items-center gap-2">
              <CheckIcon />
              <span>Everything in Pro, plus:</span>
            </li>
            <li className="flex items-center gap-2">
              <svg
                className="w-4 h-4 text-purple-400 shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                />
              </svg>
              <span className="text-white font-medium">
                Support development
              </span>
            </li>
            <li className="flex items-center gap-2">
              <CheckIcon />
              <span>Early access to new features</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckIcon />
              <span>A really cool badge on Discord!</span>
            </li>
          </ul>
          {isSupporterGrayed ? (
            <div className="mt-10 py-2 text-center text-sm text-gray-500 font-medium">
              {currentLevel === 2
                ? "Your current plan"
                : "Included in your plan"}
            </div>
          ) : (
            <button
              onClick={() =>
                user ? handleCheckout("supporter") : setShowLoginModal(true)
              }
              disabled={checkingOutPlan !== null}
              className="w-full py-2 mt-10 bg-purple-500 text-white font-medium rounded-lg hover:bg-purple-400 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {checkingOutPlan === "supporter"
                ? "Redirecting..."
                : "Become a Supporter"}
            </button>
          )}
        </div>
      </div>

      {/* Enterprise Contact */}
      <div className="text-center">
        <p className="text-gray-400 text-sm">
          Need a bigger plan for your team or organisation? Talk to us at{" "}
          <a
            href="mailto:contact@teamcomp.lol"
            className="text-lol-gold hover:text-lol-gold-light transition-colors"
          >
            contact@teamcomp.lol
          </a>
        </p>
      </div>

      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
      />
    </div>
  );
}
