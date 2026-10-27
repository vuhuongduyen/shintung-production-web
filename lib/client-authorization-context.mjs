// This is a client display-cache boundary, never an authorization decision.
// Ignore cosmetic profile fields and grant ordering; include effective scope.
export function clientAuthorizationKey(identity) {
  if (!identity?.authenticated || !identity.session) return '';
  const session=identity.session;
  const grant=value=>String(value).trim().toLowerCase().replaceAll('_',' ').replace(/\s+/g,' ');
  return JSON.stringify({
    kind:session.kind, login:session.login||'', line:session.line||'',
    role:String(session.role||'').toUpperCase(), isAdmin:session.isAdmin===true,
    grants:[...new Set((session.grants||[]).map(grant))].sort(),
    allocationGroup:session.kind==='account' && ['C','AB'].includes(session.allocationGroup)?session.allocationGroup:null,
    isSetupAdmin:session.isSetupAdmin===true,
    setupAdminExpiresAt:session.isSetupAdmin?session.setupAdminExpiresAt||null:null,
  });
}
