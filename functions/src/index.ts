import { app } from '@azure/functions';

// Entry point for the Azure Functions v4 programming model. Functions register
// themselves here (for example `app.eventGrid(...)`); none exist yet.
app.setup({ enableHttpStream: false });
