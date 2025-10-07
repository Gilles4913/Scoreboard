import { supa } from './supabase';
import type { MatchState } from '@pkg/types';
import type { BroadcastPayload } from '@pkg/logic';

export function channelKey(org: string, matchId: string, token: string){ return `match:${org}:${matchId}:${token}`; }
  
export function createOperatorChannel(org: string, matchId: string, token: string, onHello:()=>void, onAck?:()=>void){
  const channelName = channelKey(org, matchId, token);
  console.log('Operator - Création du canal:', channelName);
  
  const ch = supa.channel(channelKey(org, matchId, token), { config: { broadcast: { ack: true }, presence: { key: 'operator' } } });
  
  let stateUpdateCallback: ((state: any) => void) | null = null;
  
  ch.on('broadcast', { event: 'hello' }, (p) => { 
    console.log('Operator - Message hello reçu:', p);
    onHello(); 
  });
  
  ch.on('broadcast', { event: 'request_state' }, (p) => { 
    console.log('Operator - Demande d\'état reçue:', p);
    onHello(); 
  });
  
  ch.on('broadcast', { event: 'state' }, (p) => { 
    console.log('Operator - État reçu:', p);
    if (stateUpdateCallback && p.payload?.state) {
      stateUpdateCallback(p.payload.state);
    }
  });
  
  // Écouter tous les messages pour debug
  ch.on('broadcast', { event: '*' }, (p) => { 
    console.log('Operator - Message reçu:', p.event, p.payload);
  });
  
  ch.subscribe((status) => { 
    console.log('Operator - Statut de souscription:', status);
    if (status === 'SUBSCRIBED') onAck?.(); 
  });
  
  return {
    publish(state: MatchState, info: any){
      console.log('Operator - Publication de l\'état:', { state, info });
      const payload: BroadcastPayload = { state, info, t: Date.now() };
      ch.send({ type: 'broadcast', event: 'state', payload });
    },
    requestSync(){
      console.log('Operator - Demande de synchronisation');
      ch.send({ type: 'broadcast', event: 'request_sync', payload: { operator: true } });
    },
    onStateUpdate(callback: (state: any) => void){
      stateUpdateCallback = callback;
    },
    close(){ 
      console.log('Operator - Fermeture du canal');
      supa.removeChannel(ch); 
    }
  }
}
