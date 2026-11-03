// Synthetic negative controls, NOT a reconstruction of a historical Site commit.
// The authorized snapshot deliberately excludes Site Git history. These model
// the two rejected behaviors while assertions still test the real current code.
export const legacyCapacityPolicyFixture = `
const toolbarGate = (name) => {
  if(name === "FeedbackInbox") return false;
  return false;
};
function LegacySession() {
  useEffect(() => {
    const verify = () => fetch('/api/site-session').then(r => r.json()).then(data => {
      if (!data.authenticated) setAuthenticated(false);
    });
    const timer = window.setInterval(verify, 30000);
    return () => window.clearInterval(timer);
  }, []);
}
`;
