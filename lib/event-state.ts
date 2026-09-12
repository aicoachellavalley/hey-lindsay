export type Fact = {key:string;layer:'portal_snapshot'|'local_decision'|'assumption';source:string;retrieved_at:string;as_of:string|null;value:unknown};
// FICTIONAL DEMO DATA. Never represents a live portal or actual attendees.
export const snapshotTime='2030-09-14T16:00:00Z';
export const initialFacts:Fact[]=[
 {key:'attendance',layer:'assumption',source:'Fictional sample only; not live attendance',retrieved_at:snapshotTime,as_of:null,value:{attending:8,waitlisted:1,cancelled:0,is_sample:true}},
 {key:'catering',layer:'local_decision',source:'Fictional sample runbook',retrieved_at:snapshotTime,as_of:null,value:{lunch:'Sandwiches',planning_headcount:8,is_sample:true}}
];
