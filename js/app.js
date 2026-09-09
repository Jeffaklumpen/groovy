const loginEmail=document.getElementById('loginEmail');
const loginPassword=document.getElementById('loginPassword');
const loginButton=document.getElementById('loginButton');
const logoutButton=document.getElementById('logoutButton');
const loginStatus=document.getElementById('loginStatus');

async function updateAuthUI(){
    const {data:{user}}=await supabaseClient.auth.getUser();

    if(user){
        loginEmail.style.display='none';
        loginPassword.style.display='none';
        loginButton.style.display='none';
        logoutButton.style.display='inline-block';
        loginStatus.textContent='Inloggad';
    }else{
        loginEmail.style.display='inline-block';
        loginPassword.style.display='inline-block';
        loginButton.style.display='inline-block';
        logoutButton.style.display='none';
        loginStatus.textContent='Ej inloggad';
    }
}

loginButton.addEventListener('click',async function(){
    const email=loginEmail.value.trim();
    const password=loginPassword.value;

    if(!email||!password){
        alert('Fyll i e-post och lösenord.');
        return;
    }

    loginButton.disabled=true;
    loginStatus.textContent='Loggar in...';

    const {data,error}=await supabaseClient.auth.signInWithPassword({
        email:email,
        password:password
    });

    if(error){
        console.error('Login error:',error);
        loginStatus.textContent='Inloggningen misslyckades';
        alert(error.message);
        loginButton.disabled=false;
        return;
    }

    console.log('Inloggad användare:',data.user);
    loginButton.disabled=false;

    await updateAuthUI();
});

logoutButton.addEventListener('click',async function(){
    await supabaseClient.auth.signOut();
    await updateAuthUI();
});

supabaseClient.auth.onAuthStateChange(function(){
    updateAuthUI();
});

updateAuthUI();
