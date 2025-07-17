const express = require('express');
const { middleware, errorMiddleware } = require('@envoy/envoy-integrations-sdk');

const app = express();
app.use(middleware());

// ROUTES //

// validates setup step
app.post('/setup', (req, res) => {
  const allowedMinutesInput = req.envoy.meta.config.ALLOWED_MINUTES
  const allowedMinutes = Number(allowedMinutesInput)

  // if not a number between 0 - 180
  if (!Number.isInteger(allowedMinutes) || allowedMinutes < 0 || allowedMinutes > 180) {
    return res.status(400).send({
        errorMessage: "Please enter a number between 0 and 180 only."
    });
  }

  // successful route
  else {
    res.send({
        ALLOWED_MINUTES: allowedMinutes
    });
  }
});

app.post('/visitor-sign-in', async (req, res) => {
  const envoy = req.envoy; // our middleware adds an "envoy" object to req.
  const job = envoy.job;
  const allowedMinutes = envoy.meta.config.ALLOWED_MINUTES;
  const visitor = envoy.payload;
  const visitorName = visitor.attributes['full-name'];
  
  const message = `${visitorName} has arrived`;
  await job.attach({ label: 'Visitor Time-Check', value: message }); // show in the Envoy dashboard.
  
  res.send({ allowedMinutes });
});

app.post('/visitor-sign-out', async (req, res) => {
  const envoy = req.envoy; // our middleware adds an "envoy" object to req.
  const job = envoy.job;
  const allowedMinutes = envoy.meta.config.ALLOWED_MINUTES;

  // visitor info
  const visitor = envoy.payload;
  const visitorName = visitor.attributes['full-name'];
  const signedInAt = visitor.attributes['signed-in-at'];
  const signedOutAt = visitor.attributes['signed-out-at'];

  try { 
    // time to calculate
    
    const signInTime = new Date(signedInAt.replace(' UTC', 'Z'));
    const signOutTime = new Date(signedOutAt.replace(' UTC', 'Z'));
    const duration = Math.round((signOutTime - signInTime) / 60000); // convert to min

    let message;
    if (duration > allowedMinutes) {
      message = `${visitorName} stayed past their allotted time.`;
    } else {
      message = `${visitorName} left within their allotted time.`;
    }

    if (job?.attach) {
      await job.attach({ label: 'Visit Time-Check', value: message });
    }

    res.send({ message });
  } catch (err) {
    const message = `Error during sign-out for ${visitorName}: ${err.message}`;
    console.error(message);
    if (job?.attach) {
      await job.attach({ label: 'Visit Time-Check', value: message });
    }
    res.send({ message });
  }
});

app.use(errorMiddleware());

const listener = app.listen(process.env.PORT || 0, () => {
  console.log(`Listening on port ${listener.address().port}`);
});