import { createClient } from '@supabase/supabase-js';
import type { MatchState } from '@pkg/types';

export function channelKey(org: string, matchId: string, token: string){ return `match:${org}:${matchId}:${token}`; }

export function connectDisplay(org: string, matchId: string, token: string, onState: (state: MatchState, info?: any)=>void){
  const url = import.meta.env.VITE_SUPABASE_URL as string;
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
  const supa = createClient(url, anon, { auth: { persistSession: false } });
  
  const channelName = channelKey(org, matchId, token);
  console.log('Display - Connexion au canal:', channelName);
  
  const ch = supa.channel(channelName, { 
    config: { 
      broadcast: { ack: true },
      presence: { key: 'display' }
    } 
  });
  
  ch.on('broadcast', { event: 'state' }, (p) => {
    console.log('Display - Message reçu:', p);
    const { state, info } = p.payload as any;
    if (state && info) {
      onState(state, info);
    }
  });
  
  ch.on('broadcast', { event: 'request_sync' }, (p) => {
    console.log('Display - Demande de synchronisation reçue:', p);
    // Le display va renvoyer son état actuel
    // Ceci sera géré par le système existant de demande d'état
  });
  
  ch.subscribe(status => {
    console.log('Display - Statut de souscription:', status);
    if (status === 'SUBSCRIBED') {
      console.log('Display - Envoi du message hello');
      ch.send({ 
        type: 'broadcast', 
        event: 'hello', 
        payload: { want: 'state', display: true } 
      });
      
      // Demander l'état actuel après 1 seconde
      setTimeout(() => {
        console.log('Display - Demande de l\'état actuel');
        ch.send({ 
          type: 'broadcast', 
          event: 'request_state', 
          payload: { display: true } 
        });
      }, 500);
      
      // Redemander l'état toutes les 3 secondes si pas de réponse
      const requestInterval = setInterval(() => {
        console.log('Display - Demande périodique de l\'état');
        ch.send({ 
          type: 'broadcast', 
          event: 'request_state', 
          payload: { display: true } 
        });
      }, 3000);
      
      // Nettoyer l'interval quand on ferme
      const originalClose = () => { 
        console.log('Display - Fermeture de la connexion');
        clearInterval(requestInterval);
        supa.removeChannel(ch); 
      };
      
      return { close: originalClose };
    }
  });
  
  return { 
    close: () => { 
      console.log('Display - Fermeture de la connexion');
      supa.removeChannel(ch); 
    } 
  };
}
