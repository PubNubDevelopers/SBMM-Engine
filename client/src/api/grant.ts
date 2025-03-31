//  Access Manager is used to lock down your keyset and only assign permissions to registered users.
//  In production, you would have some kind of log-in server and authentication, then once logged in
//  you can assign permissions based on that user's ID.  Since the showcase does not require authentication
//  to log-in, it is more permissive than a production app would be.
async function requestAccessManagerToken(userId: string) {
  try{
    console.log("Calling server");
    const SERVER = 'https://devrel-demos-access-manager.netlify.app/.netlify/functions/api';
    // const SERVER = 'http://localhost:8080/.netlify/functions/api';
    const TOKEN_SERVER = `${SERVER}/sbmm`;
    console.log("waiting");
    const response = await fetch(`${TOKEN_SERVER}/grant`, {
      method: 'POST',
      headers: {
          'Content-Type': 'application/json',
      },
      body: JSON.stringify({ "UUID": userId })
    });

    const token = (await response.json()).body.token;

    console.log(token);

    return token;
  }
  catch(e){
    return null;
  }
}