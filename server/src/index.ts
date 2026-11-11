import './env.js';
// npm start is production by default; npm run server/dev remains development.
process.env.NODE_ENV ||= process.env.npm_lifecycle_event==='dev'?'development':'production';
const {app}=await import('./app.js');
const {startScheduler,stopScheduler}=await import('./services/scheduler.js');
const {default:prisma}=await import('./db.js');
const port=Number(process.env.PORT||5000);
if(!Number.isInteger(port)||port<0||port>65535)throw new Error('PORT must be a valid port number');
const server=app.listen(port,process.env.HOST||'0.0.0.0',()=>{console.log(`AgroBozor listening on port ${(server.address() as any).port}`);startScheduler();});
let stopping=false;
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{
 if(stopping)return;stopping=true;stopScheduler();
 server.close(async()=>{await prisma.$disconnect();process.exit(0);});
 setTimeout(()=>process.exit(1),10000).unref();
});
