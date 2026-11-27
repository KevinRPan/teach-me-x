import { useEffect, useState } from 'react';
import Onboarding from './components/Onboarding';
import Dashboard from './components/Dashboard';
import PlanReview from './components/PlanReview';
import PlanRevision from './components/PlanRevision';
import PathwaysSelection from './components/PathwaysSelection';
import LoadingScreen from './components/LoadingScreen';
import PhoneShell from './components/PhoneShell';
import {
  confirmPlan,
  createPathways,
  createPlan,
  getState,
  resetPlan,
  revisePlan,
  saveLesson,
  sendChat,
} from './lib/api';

function viewFor(state) {
  if (state.plan && state.planStatus === 'active') return 'dashboard';
  if (state.plan && state.planStatus === 'draft') return 'review';
  if (state.pathways?.length) return 'pathways';
  return 'onboarding';
}

export default function App() {
  const [booting, setBooting] = useState(true);
  const [bootError, setBootError] = useState('');
  const [view, setView] = useState('onboarding');
  const [sampleMode, setSampleMode] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const [pathways, setPathways] = useState([]);
  const [selectedPathways, setSelectedPathways] = useState([]);
  const [plan, setPlan] = useState(null);
  const [hasRevised, setHasRevised] = useState(false);
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  const applyState = (state, nextView = viewFor(state)) => {
    setSampleMode(Boolean(state.sampleMode));
    setUserProfile(state.profile || null);
    setPathways(state.pathways || []);
    setSelectedPathways(state.selectedPathways || []);
    setPlan(state.plan || null);
    setHasRevised(Boolean(state.hasRevised));
    setMessages(state.messages || []);
    setView(nextView);
  };

  const load = () => {
    setBooting(true);
    setBootError('');
    return getState()
      .then((state) => {
        applyState(state);
        setBooting(false);
      })
      .catch((loadError) => {
        setBootError(loadError.message);
        setBooting(false);
      });
  };

  useEffect(() => {
    let cancelled = false;
    getState()
      .then((state) => {
        if (cancelled) return;
        applyState(state);
        setBooting(false);
      })
      .catch((loadError) => {
        if (cancelled) return;
        setBootError(loadError.message);
        setBooting(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleOnboardingComplete = async (profile) => {
    setUserProfile(profile);
    setError('');
    setView('generating-pathways');
    try {
      applyState(await createPathways(profile));
    } catch (requestError) {
      setError(requestError.message);
      setView('onboarding');
    }
  };

  const handlePathwaysConfirm = async (pathwayIds) => {
    setError('');
    setView('generating-plan');
    try {
      applyState(await createPlan(pathwayIds));
    } catch (requestError) {
      setError(requestError.message);
      setView('pathways');
    }
  };

  const handleReviewConfirm = async () => {
    setError('');
    try {
      applyState(await confirmPlan());
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const handleRevisionComplete = async (feedback) => {
    setError('');
    setView('revising-loading');
    try {
      applyState(await revisePlan(feedback));
    } catch (requestError) {
      setError(requestError.message);
      setView('revising');
    }
  };

  const handleReset = async () => {
    setError('');
    try {
      applyState(await resetPlan());
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const handleSaveStep = async (dayId, stepId, extra = {}) => {
    const state = await saveLesson(dayId, stepId, extra);
    setPlan(state.plan);
    return state;
  };

  const handleSend = async (message) => {
    setSending(true);
    setError('');
    setMessages((current) => [...current, { role: 'user', content: message }]);
    try {
      const state = await sendChat(message);
      setMessages(state.messages || []);
    } catch (requestError) {
      setMessages((current) => current.slice(0, -1));
      setError(requestError.message);
      throw requestError;
    } finally {
      setSending(false);
    }
  };

  if (booting) {
    return <LoadingScreen topic={userProfile?.topic} label="Opening your companion" />;
  }

  if (bootError && !userProfile && !plan) {
    return (
      <PhoneShell banner={bootError}>
        <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
          <h1 className="text-2xl font-semibold">Can’t reach the server</h1>
          <p className="mt-2 text-sm text-neutral-400">The plan is saved with the app server. Start it, then try again.</p>
          <button type="button" onClick={load} className="mt-6 min-h-12 rounded-2xl bg-white px-6 font-semibold text-black">
            Try again
          </button>
        </div>
      </PhoneShell>
    );
  }

  if (view === 'generating-pathways' || view === 'generating-plan' || view === 'revising-loading') {
    return (
      <LoadingScreen
        topic={userProfile?.topic}
        isRevising={view === 'revising-loading'}
        sampleMode={sampleMode}
      />
    );
  }

  if (view === 'pathways') {
    return (
      <PathwaysSelection
        pathways={pathways}
        topic={userProfile?.topic}
        onConfirm={handlePathwaysConfirm}
        onBack={() => setView('onboarding')}
        sampleMode={sampleMode}
        banner={error}
        onDismissBanner={() => setError('')}
      />
    );
  }

  if (view === 'review' && plan) {
    return (
      <PlanReview
        plan={plan}
        userProfile={userProfile}
        selectedPathways={selectedPathways}
        onConfirm={handleReviewConfirm}
        onRevise={() => {
          setError('');
          setView('revising');
        }}
        onReset={handleReset}
        hasRevised={hasRevised}
        sampleMode={sampleMode}
        banner={error}
        onDismissBanner={() => setError('')}
      />
    );
  }

  if (view === 'revising' && plan) {
    return (
      <PlanRevision
        plan={plan}
        onRevise={handleRevisionComplete}
        onCancel={() => setView('review')}
        sampleMode={sampleMode}
        banner={error}
        onDismissBanner={() => setError('')}
      />
    );
  }

  if (view === 'dashboard' && plan) {
    return (
      <Dashboard
        plan={plan}
        messages={messages}
        sampleMode={sampleMode}
        banner={error}
        onDismissBanner={() => setError('')}
        onSaveStep={handleSaveStep}
        onSend={handleSend}
        onReset={handleReset}
        sending={sending}
      />
    );
  }

  return (
    <Onboarding
      initialProfile={userProfile}
      onComplete={handleOnboardingComplete}
      sampleMode={sampleMode}
      banner={error}
      onDismissBanner={() => setError('')}
    />
  );
}
