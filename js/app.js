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

(function(){

var records = [

  ['01','ABBA','The Album','1977','Pop',3,'covers/the_album.jpg',{
    A:['Eagle|3','Take a Chance On Me|4','One Man, One Woman|4','The Name Of The Game|3'],
    B:['Move On|2','Hole In Your Soul|4','Thank You For The Music|4','I Wonder (Departure)|2',"I'm A Marionette|1"]
  }],

  ['02','ABBA','Super Trouper','1980','Pop',4,'covers/super_trouper.jpg',{
    A:['Super Trouper|5','The Winner Takes It All|5','On And On And On|4','Andante, Andante|3','Me And I|3'],
    B:['Happy New Year|4','Our Last Summer|4','The Piper|3','Lay All Your Love On Me|5','The Way Old Friends Do|3']
  }],

  ['03','a-ha','Hunting High And Low','1985','Synth-pop',3,'covers/hunting_high_and_low.jpg',{
    A:['Take On Me|5','Train Of Thought|2','Hunting High And Low|2','The Blue Sky|3','Living A Boy’s Adventure Tale|3'],
    B:['The Sun Always Shines On TV|4','And You Tell Me|3','Love Is Reason|3','Dream Myself Alive|3','Here I Stand And Face The Rain|2']
  }],

  ['04','The Alan Parsons Project','I Robot','1977','Progressive Rock',2,'covers/i_robot.jpg',{
    A:['I Robot|2','I Wouldn’t Want To Be Like You|3','Some Other Time|3','Breakdown|2','Don’t Let It Show|4'],
    B:['The Voice|2','Nucleus|1','Day After Day (The Show Must Go On)|2','Total Eclipse|1','Genesis Ch. 1 V.32|2']
  }],

  ['05','The Alan Parsons Project','The Turn Of A Friendly Card','1980','Progressive Rock',3,'covers/turn_of_a_friendly_card.jpg',{
    A:['May Be A Price To Pay|4','Games People Play|4','Time|3','I Don’t Wanna Go Home|4'],
    B:['The Gold Bug|2','The Turn Of A Friendly Card (Part 1)|3','The Turn Of A Friendly Card: Snake Eyes|3','The Turn Of A Friendly Card: The Ace Of Swords|3','The Turn Of A Friendly Card: Nothing Left To Lose|3','The Turn Of A Friendly Card (Part 2)|3']
  }],

  ['06','Andrew Lloyd Webber','The Phantom Of The Opera','1987','Musical',4,'covers/phantom_of_the_opera.jpg',{
    A:['Prologue|1','Overture|4','Think Of Me|3','Angel Of Music|3','Little Lotte / The Mirror (Angel Of Music)|3','The Phantom Of The Opera|5','The Music Of The Night|5','I Remember / Stranger Than You Dreamt It|2'],
    B:['Magical Lasso|1','Notes / Prima Donna|1','Poor Fool, He Makes Me Laugh|1',"Why Have You Brought Me Here|2",'All I Ask Of You|5','All I Ask Of You (Reprise)|4'],
    C:['Entr’acte|4','Masquerade / Why So Silent|2','Notes / Twisted Every Way|2','Wishing You Were Somehow Here Again|3','Wandering Child / Bravo, Monsieur|2'],
    D:['The Point Of No Return|5','Down Once More / Track Down This Murderer|5']
  }],

  ['07','Art Garfunkel','Fate For Breakfast','1979','Soft Rock',3,'covers/fate_for_breakfast.jpg',{
    A:["In A Little While (I'll Be On My Way)|3","Since I Don't Have You|3",'And I Know|2','Sail On A Rainbow|2','Miss You Nights|4'],
    B:['Bright Eyes|4','Finally Found A Reason|3','Beyond The Tears|3','Oh How Happy|2',"When Someone Doesn't Want You|2",'Take Me Away|3']
  }],

  ['08','The Beatles','Help!','1965','Rock',3,'covers/help.jpg',{
    A:['Help!|5','The Night Before|4',"You've Got To Hide Your Love Away|4",'I Need You|3','Another Girl|3',"You're Going To Lose That Girl|2",'Ticket To Ride|3'],
    B:['Act Naturally|2',"It's Only Love|3",'You Like Me Too Much|2','Tell Me What You See|3',"I've Just Seen A Face|2",'Yesterday|5','Dizzy Miss Lizzy|3']
  }],

  ['09','Benny Andersson & Björn Ulvaeus','Chess','1986','Musical',3,'covers/chess.jpg',{
    A:['Merano|3','The Russian And Molokov / Where I Want To Be|2','Opening Ceremony|3','Quartet (A Model Of Decorum And Tranquility)|2'],
    B:['The American And Florence / Nobody’s Side|4','Chess|4','Mountain Duet|3','Florence Quits|2','Embassy Lament|2','Anthem|5'],
    C:['Bangkok / One Night In Bangkok|5','Heaven Help My Heart|3','Argument|2','I Know Him So Well|3','The Deal (No Deal)|3','Pity The Child|3'],
    D:['Endgame|3','Epilogue: You And I / The Story Of Chess|4']
  }],

  ['10','Christopher Larkin','Hollow Knight','2017','Soundtrack',3,'covers/hollow_knight.jpg',{
    A:['Enter Hallownest|5','Dirtmouth|4','Crossroads|2','False Knight|3','Greenpath|3','Hornet|4','Reflection|3'],
    B:['Mantis Lords|4','City Of Tears|3','Dung Defender|3','Crystal Peak|2','Fungal Wastes|3','Decisive Battle|3'],
    C:['Soul Sanctum|3','Resting Grounds|3',"Queen's Gardens|3",'The White Lady|3','Broken Vessel|4',"Kingdom's Edge|3",'Nosk|4'],
    D:['Dream|2','Dream Battle|2','White Palace|4','Sealed Vessel|5','Radiance|3','Hollow Knight|4']
  }],

  ['11','C418','Volume Alpha','2011','Ambient/Electronic',3,'covers/minecraft.jpg',{
    A:['Subwoofer Lullaby|4','Living Mice|3','Moog City|2','Haggstrom|3','Minecraft|5','Clark|4'],
    B:['Mice On Venus|4','Dry Hands|2','Wet Hands|2','Sweden|5','Cat|3','Danny|2']
  }],
  
  ['12','Dave Clark','Time','1986','Rock/Pop/Concept',3,'covers/time.jpg',{
    A:["Born To Rock 'N' Roll|4","Time Talkin'|4",'Time|3','Music Of The Spheres|1','Law Of The Universe|3','The Time Lord Theme|3','The Charge|3','One Human Family|3'],
    B:['What On Earth|3','I Know, I Know|3','Your Brother In Soul|3','Case For The Prosecution|3','Star Maker|2','Time Will Teach Us All|2','I Object|2','In My Defence|4'],
    C:['Within My World|3','Because|3','Move The Judge|4',"She's So Beautiful|2",'Beauty, Truth, Love, Freedom, Peace|1','If You Only Knew|2'],
    D:["We're The U.F.O.|3","The Theme From 'Time'|1",'Harmony|2','The Return|0','Time (Reprise)|2',"It's In Every One Of Us|3"]
  }],
  
  ['13','David Bowie',"Let's Dance",'1983','Post-disco/New wave',2,'covers/lets_dance.jpg',{
    A:['Modern Love|3','China Girl|2',"Let's Dance|4",'Without You|2'],
    B:['Ricochet|3','Criminal World|2','Cat People (Putting Out Fire)|2','Shake It|2']
  }],
  
  ['14','Dire Straits','Dire Straits','1978','Blues rock',3,'covers/dire_straits.jpg',{
    A:['Down To The Waterline|3','Water Of Love|2','Setting Me Up|3','Six Blade Knife|3','Southbound Again|2'],
    B:['Sultans Of Swing|4','In The Gallery|3','Wild West End|2','Lions|2']
  }],
  
  ['15','The Eagles','Hotel California','1976','Rock',3,'covers/hotel_california.jpg',{
    A:['Hotel California|5','New Kid In Town|3','Life In The Fast Lane|2','Wasted Time|4'],
    B:['Wasted Time (Reprise)|3','Victim Of Love|3','Pretty Maids All In A Row|2','Try And Love Again|2','The Last Resort|2']
  }],
  
  ['16','Electric Light Orchestra','Discovery','1979','Pop rock/Disco',4,'covers/discovery.jpg',{
    A:['Shine A Little Love|4','Confusion|4','Need Her Love|3','The Diary Of Horace Wimp|4'],
    B:['Last Train To London|4','Midnight Blue|3','On The Run|3','Wishing|3',"Don't Bring Me Down|5"]
  }],
  
  ['17','Electric Light Orchestra','Out Of The Blue','1977','Orchestral pop',3,'covers/out_of_the_blue.jpg',{
    A:['Turn To Stone|4',"It's Over|3","Sweet Talkin' Woman|3",'Across The Border|3'],
    B:['Night In The City|3','Starlight|3','Jungle|2','Believe Me Now|3',"Steppin' Out|3"],
    C:["Standin' In The Rain|4",'Big Wheels|3','Summer And Lightning|3','Mr. Blue Sky|5'],
    D:['Sweet Is The Night|3','The Whale|2','Birmingham Blues|3','Wild West Hero|3']
  }],
  
  ['18','Elton John','Elton John','1970','Soft rock',4,'covers/elton_john.jpg',{
    A:['Your Song|5','I Need You To Turn To|4','Take Me To The Pilot|5','No Shoe Strings On Louise|2','First Episode At Hienton|3'],
    B:['Sixty Years On|3','Border Song|4','The Greatest Discovery|3','The Cage|4','The King Must Die|3']
  }],
  
  ['19','Europe','The Final Countdown','1986','Glam metal/Hard rock',4,'covers/the_final_countdown.jpg',{
    A:['The Final Countdown|5','Rock The Night|4','Carrie|4','Danger On The Track|3','Ninja|4'],
    B:['Cherokee|4','Time Has Come|3','Heart Of Stone|4','On The Loose|3','Love Chaser|3']
  }],
  
  ['20','Eurythmics','Sweet Dreams (Are Made Of This)','1983','Synth-pop/New wave',3,'covers/sweet_dreams.jpg',{
    A:['Love Is A Stranger|3',"I've Got An Angel|2",'Wrap It Up|3','I Could Give You (A Mirror)|3','The Walk|4'],
    B:['Sweet Dreams (Are Made Of This)|5','Jennifer|2','This Is The House|2','Somebody Told Me|3','This City Never Sleeps|2']
  }],
  
  ['21','First Aid Kid','Palomino','2022','Folk',0,'covers/palomino.jpg',{
    A:['Out Of My Head|0','Angel|0','Ready To Run|0','Turning Onto You|0','Fallen Snow|0','Wild Horses II|0'],
    B:['The Last One|0','Nobody Knows|0','A Feeling That Never Came|0','29 Palms Highway|0','Palomino|0']
  }],
  
  ['22','Fleetwood Mac','Behind The Mask','1990','Pop rock',3,'covers/behind_the_mask.jpg',{
    A:['Skies The Limit|3','Love Is Dangerous|2','In The Back Of My Mind|3','Do You Know|2','Save Me|3','Affairs Of The Heart|3'],
    B:['When The Sun Goes Down|2','Behind The Mask|3','Stand On The Rock|2','Hard Feelings|3','Freedom|2','When It Comes To Love|3','The Second Time|3']
  }],

  ['23','Fleetwood Mac','Tusk','1979','Rock',0,'covers/tusk.jpg',{
    A:['Over & Over|0','The Ledge|0','Think About Me|0','Save Me A Place|0','Sara|0'],
    B:["What Makes You Think You're The One|0",'Storms|0',"That's All For Everyone|0",'Not That Funny|0','Sisters Of The Moon|0'],
    C:['Angel|0',"That's Enough For Me|0",'Brown Eyes|0','Never Make Me Cry|0',"I Know I'm Wrong|0"],
    D:['Honey Hi|0','Beautiful Child|0','Walk a Thin Line|0','Tusk|0','Never Forget|0']
  }],

  ['24','Graeme Edge Band','Kick Off Your Muddy Boots','1975','Rock',3,'covers/muddy_boots.jpg',{
    A:['Bareback Rider|4','In Dreams|3','Lost In Space|4','Have You Ever Wondered|3'],
    B:["My Life's Not Wasted|3",'The Tunnel|3','Gew Janna Woman|3','Shotgun|2',"Somethin' We'd Like To Say|3"]
  }],

  ['25','Jeff Wayne','The War Of The Worlds','1978','Progressive Rock',5,'covers/war_of_the_worlds.jpg',{
    A:['The Eve Of The War|5','Horsell Common And The Heat Ray|5'],
    B:['The Artilleryman And The Fighting Machine|4','Forever Autumn|5','Thunder Child|5'],
    C:['The Red Weed (Part 1)|2','The Spirit Of Man|4','The Red Weed (Part 2)|3','The Artilleryman Returns|3'],
    D:['Brave New World|3','Dead London|3','Epilogue (Part 1)|3','Epilogue (Part 2) (NASA)|1']
  }],

  ['26','Jethro Tull','M.U The Best Of Jethro Tull','1976','Progressive Rock',3,'covers/best_of_jethro_tull.jpg',{
    A:['Teacher|3','Aqualung|4','Thick As A Brick Edit #1|4','Bungle In The Jungle|3','Locomotive Breath|3'],
    B:['Fat Man|2','Living In The Past|3','A Passion Play Edit #8|3','Skating Away (On The Thin Ice Of The New Day)|3','Rainbow Blues|3','Nothing Is Easy|2']
  }],

  ['27','John Miles','Stranger In The City','1977','Rock',3,'covers/stranger_in_the_city.jpg',{
    A:['Stranger In The City|3','Slow Down|4','Stand Up (And Give Me A Reason)|4','Time|3'],
    B:['Manhattan Skyline|3','Glamour Boy|3','Do It Anyway|3','Remember Yesterday|3','Music Man|3']
  }],

  ['28','Jon Bon Jovi','Blaze Of Glory','1990','Rock',3,'covers/blaze_of_glory.jpg',{
    A:['Billy Get Your Guns|3','Miracle|2','Blaze Of Glory|4','Blood Money|3','Santa Fe|4'],
    B:['Justice In The Barrel|3','Never Say Die|3','You Really Got Me Now|2','Bang A Drum|3',"Dyin' Ain't Much Of A Livin'|4",'Guano City|2']
  }],

  ['29','Journey','Frontiers','1983','Rock',0,'covers/frontiers.jpg',{
    A:['Separate Ways (Worlds Apart)|5','Send Her My Love|3','Chain Reaction|3','After The Fall|0','Faithfully|0'],
    B:['Edge Of The Blade|0','Troubled Child|0','Back Talk|0','Frontiers|0','Rubicon|0']
  }],

  ['30','Koto','Greatest Hits & Remixes','1992','Electronic',0,'covers/koto_greatest_hits_remixes.jpg',{
    A:['Jabdah (Original ZYX Remix)|0','Visitors (Vocal Remix)|0','Japanese War Game (Master Mix)|0',"Champion's Cue (Billiard Mix)|0"],
    B:["Dragon's Legend (Maxi Version)|0",'Mind Machine|0','Time|0','The Koto Mix|0']
  }],

  ['31','Level 42','World Machine','1985','Pop',0,'covers/world_machine.jpg',{
    A:['World Machine|0','Physical Presence|0','Something About You|0','Leaving Me Now|0'],
    B:['I Sleep On My Heart|0',"It's Not The Same For Us|0",'Good Man In A Storm|0','Coup D\'etat|0','Lying Still|0']
  }],

  ['32','Maromaro','Full Moon','2026','Electronic',0,'covers/full_moon.jpg',{
    A:['Moonlighting|0','Trickster|0','Premonition|0','Solstice|0','Higher|0'],
    B:['Glass|0','Bandersnatch|0','Closer|0','Truffle|0','Vivid|0']
  }],

  ['33','Men At Work','Cargo','1983','Pop',0,'covers/cargo.jpg',{
    A:['Dr. Heckyll & Mr. Jive|0','Overkill|0','Settle Down My Boy|0','Upstairs In My House|0','No Sign Of Yesterday|0'],
    B:["It's A Mistake|0",'High Wire|0','Blue For You|0','I Like To|0','No Restrictions|0']
  }],

  ['34','Michael Jackson','Bad','1987','Pop',0,'covers/bad.jpg',{
    A:['Bad|0','The Way You Make Me Feel|0','Speed Demon|0','Liberian Girl|0','Just Good Friends|0'],
    B:['Another Part Of Me|0','Man In The Mirror|0',"I Just Can't Stop Loving You|0",'Dirty Diana|0','Smooth Criminal|0']
  }],

  ['35','Mike Curb Congregation','Sweet Gingerbread Man','1970','Pop',0,'covers/sweet_gingerbread_man.jpg',{
    A:['Sweet Gingerbread Man|0','Let It Be|0','Bringing In The Sheaves|0','Spirit In The Sky|0','This Land Is Your Land|0','My Home Town|0'],
    B:['Burning Bridges|0','Teach Your Children|0','The Long And Winding Road|0','Everything Is Beautiful|0','Lead Us On|0']
  }],

  ['36','Muse','Origin Of Symmetry','2001','Alternative Rock',0,'covers/origin_of_symmetry.jpg',{
    A:['New Born|0','Bliss|0'],
    B:['Space Dementia|0','Hyper Music|0','Plug In Baby|0'],
    C:['Citizen Erased|0','Micro Cuts|0','Screenager|0'],
    D:['Darkshines|0','Feeling Good|0','Megalomania|0']
  }],

  ['37','Muse','The Resistance','2009','Alternative Rock',0,'covers/the_resistance.jpg',{
    A:['Uprising|0','Resistance|0','Undisclosed Desires|0'],
    B:['United States Of Eurasia (+Collateral Damage)|0','Guiding Light|0'],
    C:['Unnatural Selection|0','MK Ultra|0','I Belong To You (+Mon Cœur S\'Ouvre A Ta Voix)|0'],
    D:['Exogenesis: Symphony Part 1 (Overture)|0','Exogenesis: Symphony Part 2 (Cross-Pollination)|0','Exogenesis: Symphony Part 3 (Redemption)|0']
  }],

  ['38','Muse','The Wow! Signal','2026','Alternative Rock',0,'covers/the_wow_signal.jpg',{
    A:['The Dark Forest|0','Nightshift Superstar|0','Shimmering Scars|0','Cryogen|0','Be With You|0'],
    B:['Hexagons|0','The Sickness In You & I|0','Unravelling|0','Hush (feat. Ellie Goulding)|0','Space Debris|0']
  }],

  ['39','Pink Floyd','The Dark Side Of The Moon','1973','Progressive Rock',0,'covers/dark_side_of_the_moon.jpg',{
    A:['Speak To Me|0','Breathe|0','On The Run|0','Time|0','The Great Gig In The Sky|0'],
    B:['Money|0','Us And Them|0','Any Colour You Like|0','Brain Damage|0','Eclipse|0']
  }],

  ['40','Pink Floyd','The Wall','1979','Progressive Rock',0,'covers/the_wall.jpg',{
    A:['In The Flesh?|0','The Thin Ice|0','Another Brick In The Wall, Part 1|0','The Happiest Days Of Our Lives|0','Another Brick In The Wall, Part 2|0','Mother|0'],
    B:['Goodbye Blue Sky|0','Empty Spaces|0','Young Lust|0','One Of My Turns|0','Don’t Leave Me Now|0','Another Brick In The Wall, Part 3|0','Goodbye Cruel World|0'],
    C:['Hey You|0','Is There Anybody Out There?|0','Nobody Home|0','Vera|0','Bring The Boys Back Home|0','Comfortably Numb|0'],
    D:['The Show Must Go On|0','In The Flesh|0','Run Like Hell|0','Waiting For The Worms|0','Stop|0','The Trial|0','Outside The Wall|0']
  }],

  ['41','Rick Astley','Whenever You Need Somebody','1987','Pop',0,'covers/whenever_you_need_somebody.jpg',{
    A:['Never Gonna Give You Up|0','Whenever You Need Somebody|0','Together Forever|0','It Would Take a Strong Strong Man|0','The Love Has Gone|0'],
    B:["Don't Say Goodbye|0",'Slipping Away|0','No More Looking For Love|0','You Move Me|0','When I Fall In Love|0']
  }],

  ['42','Rick Wakeman','Journey To The Centre Of The Earth','1974','Progressive Rock',0,'covers/journey_to_the_centre_of_the_earth.jpg',{
    A:['The Journey|0','Recollection|0'],
    B:['The Battle|0','The Forest|0']
  }],

  ['43','Rick Wakeman','The Myths And Legends Of King Arthur And The Knights Of The Round Table','1975','Progressive Rock',0,'covers/the_myths_and_legends_of_king_arthur.jpg',{
    A:['Arthur|0','Lady Of The Lake|0','Guinevere|0','Sir Lancelot And The Black Knight|0'],
    B:['Merlin The Magician|0','Sir Galahad|0','The Last Battle|0']
  }],

  ['44','Rod Stewart','The Best Of Rod Stewart','1989','Rock',0,'covers/best_of_rod_stewart.jpg',{
    A:['Maggie May|0','Baby Jane|0',"Da Ya Think I'm Sexy?|0",'This Old Heart Of Mine|0','Sailing|0',"I Don't Want To Talk About It|0"],
    B:["You're In My Heart (The Final Acclaim)|0",'Young Turks|0','The First Cut Is The Deepest|0',"Tonight's The Night (Gonna Be Alright)|0",'Every Beat Of My Heart|0','Downtown Train|0']
  }],

  ['45','Simon And Garfunkel','Bridge Over Troubled Water','1970','Pop',0,'covers/bridge_over_troubled_water.jpg',{
    A:['Bridge Over Troubled Water|0','El Condor Pasa (If I Could)|0','Cecilia|0','Keep The Customer Satisfied|0','So Long, Frank Lloyd Wright|0'],
    B:['The Boxer|0','Baby Driver|0','The Only Living Boy In New York|0',"Why Don't You Write Me|0",'Bye Bye Love|0','Song For The Asking|0']
  }],

  ['46','Starship','Knee Deep In The Hoopla','1985','Rock',0,'covers/knee_deep_in_the_hoopla.jpg',{
    A:['We Built This City|0','Sara|0',"Tomorrow Doesn't Matter Tonight|0",'Rock Myself To Sleep|0','Desperate Heart|0'],
    B:['Private Room|0','Before I Go|0','Hearts Of The World (Will Understand)|0','Love Rusts|0']
  }],

  ['47','Status Quo','Just Supposin','1980','Rock',0,'covers/just_supposin.jpg',{
    A:["What You're Proposing|0",'Run To Mummy|0',"Don't Drive My Car|0",'Lies|0','Over The Edge|0'],
    B:['The Wild Ones|0','Name Of The Game|0','Coming And Going|0',"Rock 'N' Roll|0"]
  }],

  ['48','Toto','Toto','1978','Rock',0,'covers/toto.jpg',{
    A:["Child's Anthem|0","I'll Supply The Love|0",'Georgy Porgy|0','Manuela Run|0','You Are The Flower|0'],
    B:['Girl Goodbye|0',"Takin' It Back|0",'Rockmaker|0','Hold The Line|0','Angela|0']
  }],

  ['49','Toto','Toto IV','1982','Rock',0,'covers/toto_iv.jpg',{
    A:['Rosanna|0','Make Believe|0',"I Won't Hold You Back|0",'Good For You|0',"It's A Feeling|0"],
    B:['Afraid Of Love|0','Lovers In The Night|0','We Made It|0','Waiting For Your Love|0','Africa|0']
  }],

  ['50','Various Artists',"Star Trackin' 76",'1976','Various',0,'covers/star_trackin.jpg',{
    A:['Tangerine|0','Squeeze Box|0','Love Roller Coaster|0','Theme From S.W.A.T.|0','Dancing Machine|0','You Sexy Thing|0',"That's The Way I Like It|0",'Lady Bump|0','Fly Robin Fly|0','Do It Any Way You Wanna|0'],
    B:['Salsoul Hustle|0','Extra Extra|0',"Keep On Truckin'|0",'I Could Have Danced All Night|0','Lady Marmalade|0','Bad Luck|0','Spider Man|0','Sexy|0','A.I.E. (A Mwana)|0','Just Too Many People|0']
  }]

];

var collection=document.getElementById('collection');
var gridButton=document.getElementById('gridButton');
var carouselButton=document.getElementById('carouselButton');
var albumOverlay=document.getElementById('albumOverlay');
var albumClose=document.getElementById('albumClose');
var detailCover=document.getElementById('detailCover');
var detailNumber=document.getElementById('detailNumber');
var detailArtist=document.getElementById('detailArtist');
var detailAlbum=document.getElementById('detailAlbum');
var detailYear=document.getElementById('detailYear');
var detailGenre=document.getElementById('detailGenre');
var detailRating=document.getElementById('detailRating');
var detailTracks=document.getElementById('detailTracks');

var view='grid';
var activeIndex=0;
var drag=false;
var selectedRating='all';
var startX=0;
var startY=0;
var startScroll=0;
var scrollTimer=null;

function esc(value){
  return String(value)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

function recordHTML(record, className){
  var smallSrc=record[6].replace('covers/','covers_small/');
  var html='<article class="record '+(className||'')+'" data-index="'+(parseInt(record[0],10)-1)+'">'+
    '<div class="cover-wrapper">'+
      '<img class="cover" loading="lazy" decoding="async" src="" data-src="'+smallSrc+'" alt="'+esc(record[1]+' - '+record[2])+'">'+
      '<div class="number">'+record[0]+'</div>'+
      '<div class="cover-rating">';

  for(var r=1;r<=5;r++){
    html+=r<=record[5]?'★':'<span class="empty">★</span>';
  }

  html+='</div>'+
    '</div>'+
    '<div class="info">'+
      '<div class="artist">'+esc(record[1])+'</div>'+
      '<div class="album">'+esc(record[2])+'</div>'+
      '<div class="year">'+esc(record[3])+'</div>'+
    '</div>'+
  '</article>';

  return html;
}

function loadVisibleImages(){
  var images=document.querySelectorAll('.cover');
  var height=window.innerHeight||600;
  var width=window.innerWidth||1024;
  var verticalMargin=450;
  var horizontalMargin=500;

  for(var i=0;i<images.length;i++){
    var img=images[i];
    var dataSrc=img.getAttribute('data-src');
    if(!dataSrc)continue;

    var rect=img.getBoundingClientRect();
    if(rect.top<height+verticalMargin&&rect.bottom>-verticalMargin&&
       rect.left<width+horizontalMargin&&rect.right>-horizontalMargin){
      img.src=dataSrc;
      img.removeAttribute('data-src');
    }
  }
}

function openAlbum(index){
  var record=records[index];
  if(!record)return;

  detailNumber.innerHTML=esc(record[0]);
  detailArtist.innerHTML=esc(record[1]);
  detailAlbum.innerHTML=esc(record[2]);
  detailYear.innerHTML=esc(record[3]);
  detailGenre.innerHTML=esc(record[4]||'Genre saknas');

  detailCover.src=record[6];
  detailCover.alt=record[1]+' - '+record[2];

  var rating=parseInt(record[5],10);
  if(isNaN(rating))rating=0;
  rating=Math.max(0,Math.min(5,rating));

  var stars='';
  for(var i=1;i<=5;i++){
    stars+=i<=rating?'★':'<span class="empty">★</span>';
  }
  detailRating.innerHTML=stars;

  var sides=record[7]||{};
  var sideNames=['A','B','C','D'];
  var html='';

  for(i=0;i<sideNames.length;i++){
    var side=sideNames[i];
    var tracks=sides[side];

    if(!tracks||!tracks.length)continue;

    html+='<section class="track-side">'+
      '<div class="side-title"><span>SIDA</span>'+side+'</div>'+
      '<ol class="tracks-list">';

  for(var j=0;j<tracks.length;j++){
    var track=String(tracks[j]);
    var parts=track.split('|');
    var title=parts[0];
    var rating=parseInt(parts[1],10);
  
    if(isNaN(rating))rating=0;
    rating=Math.max(0,Math.min(5,rating));
  
    var trackStars='';
    for(var s=1;s<=5;s++){
      trackStars+=s<=rating?'★':'<span class="empty">☆</span>';
    }
  
    html+='<li><span class="track-title">'+esc(title)+'</span><span class="track-rating">'+trackStars+'</span></li>';
  }

    html+='</ol></section>';
  }

  detailTracks.innerHTML=html||
    '<div style="color:#666;font-size:13px">Ingen låtlista tillagd</div>';

  albumOverlay.className='album-overlay visible';
  document.body.style.overflow='hidden';
}

function closeAlbum(){
  albumOverlay.className='album-overlay';
  document.body.style.overflow='';

  setTimeout(function(){
    if(albumOverlay.className.indexOf('visible')===-1){
      detailCover.src='';
    }
  },350);
}


function attachAlbumClicks(){
  if(collection._albumClickAttached)return;
  collection._albumClickAttached=true;

  collection.onclick=function(event){
    event=event||window.event;
    var target=event.target||event.srcElement;

    while(target&&target!==collection&&(!target.className||String(target.className).indexOf('record')===-1)){
      target=target.parentNode;
    }

    if(!target||target===collection)return;
    if(view==='carousel'&&drag)return;

    var index=parseInt(target.getAttribute('data-index'),10);
    if(!isNaN(index))openAlbum(index);
  };
}

function buildGrid(){
  collection.className='collection grid';

  var html='';

  for(var i=0;i<records.length;i++){
    var rating=parseInt(records[i][5],10);

    if(selectedRating==='all'||rating===parseInt(selectedRating,10)){
      html+=recordHTML(records[i],'');
    }
  }

  collection.innerHTML=html;
  attachAlbumClicks();
  loadVisibleImages();
}

function setActive(index){
  activeIndex=index;

  var cards=document.getElementsByClassName('carousel-card');

  for(var i=0;i<cards.length;i++){
    cards[i].className=cards[i].className.replace(/\sactive\b/g,'');

    if(i===index){
      cards[i].className+=' active';
    }
  }
}

function animateScroll(element,to,smooth){
  if(!smooth){
    element.scrollLeft=to;
    return;
  }

  if(element.scrollTo){
    try{
      element.scrollTo({left:to,behavior:'smooth'});
      return;
    }catch(e){}
  }

  var from=element.scrollLeft;
  var change=to-from;
  var duration=420;
  var start=new Date().getTime();

  function step(){
    var time=new Date().getTime();
    var progress=Math.min(1,(time-start)/duration);
    var easing=progress*(2-progress);
    element.scrollLeft=from+change*easing;
    if(progress<1)setTimeout(step,16);
  }
  step();
}

function centerCard(index,smooth){
  var viewport=document.getElementById('carouselViewport');
  var cards=document.getElementsByClassName('carousel-card');
  var card=cards[index];

  if(!viewport||!card)return;

  var target=card.offsetLeft-(viewport.clientWidth-card.offsetWidth)/2;
  var max=viewport.scrollWidth-viewport.clientWidth;

  target=Math.max(0,Math.min(target,max));

  setActive(index);
  animateScroll(viewport,target,smooth);
}

function nearest(){
  var viewport=document.getElementById('carouselViewport');
  var cards=document.getElementsByClassName('carousel-card');
  var center=viewport.scrollLeft+viewport.clientWidth/2;

  var best=0;
  var distance=Infinity;

  for(var i=0;i<cards.length;i++){
    var card=cards[i];
    var cardCenter=card.offsetLeft+card.offsetWidth/2;
    var currentDistance=Math.abs(cardCenter-center);

    if(currentDistance<distance){
      distance=currentDistance;
      best=i;
    }
  }

  return best;
}

function buildCarousel(){
  collection.className='collection carousel';

  var html=
    '<div class="carousel-viewport" id="carouselViewport">'+
      '<div class="carousel-track" id="carouselTrack">';

  for(var i=0;i<records.length;i++){
    var rating=parseInt(records[i][5],10);
  
    if(selectedRating==='all'||rating===parseInt(selectedRating,10)){
      html+=recordHTML(records[i],'carousel-card');
    }
  }

  html+='</div></div>';
  collection.innerHTML=html;
  loadVisibleImages();
  
  var viewport=document.getElementById('carouselViewport');
  var cards=document.getElementsByClassName('carousel-card');

  attachAlbumClicks();

  function scheduleSettle(){
    if(scrollTimer)clearTimeout(scrollTimer);

    scrollTimer=setTimeout(function(){
      setActive(nearest());
    },180);
  }

  viewport.onscroll=function(){
    scheduleImageLoad();
    scheduleSettle();
  };

  viewport.ontouchstart=function(event){
    if(!event.touches||!event.touches.length)return;

    drag=false;
    startX=event.touches[0].pageX;
    startY=event.touches[0].pageY;
    startScroll=viewport.scrollLeft;

    if(scrollTimer)clearTimeout(scrollTimer);
  };

  viewport.ontouchmove=function(event){
    if(!event.touches||!event.touches.length)return;

    var dx=event.touches[0].pageX-startX;

    if(Math.abs(dx)>8)drag=true;
  };

  viewport.ontouchend=function(){
    scheduleSettle();

    setTimeout(function(){
      drag=false;
    },120);
  };

  setTimeout(function(){
    centerCard(activeIndex,false);
    scheduleImageLoad();
  },30);
}

function setView(nextView){
  view=nextView;

  gridButton.className=view==='grid'?'active':'';
  carouselButton.className=view==='carousel'?'active':'';

  gridButton.setAttribute('aria-pressed',view==='grid'?'true':'false');
  carouselButton.setAttribute('aria-pressed',view==='carousel'?'true':'false');

  if(view==='grid'){
    buildGrid();
  }else{
    buildCarousel();
  }
}

gridButton.onclick=function(){
  setView('grid');
};

carouselButton.onclick=function(){
  setView('carousel');
};

albumClose.onclick=function(){
  closeAlbum();
};

albumOverlay.onclick=function(event){
  if((event||window.event).target===albumOverlay){
    closeAlbum();
  }
};

document.onkeydown=function(event){
  event=event||window.event;

  if(event.keyCode===27){
    if(albumOverlay.className.indexOf('visible')!==-1){
      closeAlbum();
    }
    return;
  }

  if(view!=='carousel')return;

  if(event.keyCode===39&&activeIndex<records.length-1){
    centerCard(activeIndex+1,true);
  }else if(event.keyCode===37&&activeIndex>0){
    centerCard(activeIndex-1,true);
  }
};

var ratingFilter=document.querySelectorAll('.rating-filter button');

for(var f=0;f<ratingFilter.length;f++){
  ratingFilter[f].onclick=function(){
    selectedRating=this.getAttribute('data-rating');

    for(var i=0;i<ratingFilter.length;i++){
      ratingFilter[i].className='';
    }

    this.className='active';

    activeIndex=0;

    if(view==='grid'){
      buildGrid();
    }else{
      buildCarousel();
    }
  };
}

var imageLoadScheduled=false;
function scheduleImageLoad(){
  if(imageLoadScheduled)return;
  imageLoadScheduled=true;
  var run=window.requestAnimationFrame||function(fn){return setTimeout(fn,50);};
  run(function(){imageLoadScheduled=false;loadVisibleImages();});
}

window.onscroll=scheduleImageLoad;

buildGrid();

})();

// ========================================
// ADD ALBUM / MUSICBRAINZ
// ========================================

const addAlbumButton=document.getElementById('addAlbumButton');
const addAlbumModal=document.getElementById('addAlbumModal');
const closeAddAlbum=document.getElementById('closeAddAlbum');
const albumSearchInput=document.getElementById('albumSearchInput');
const albumSearchResults=document.getElementById('albumSearchResults');

let searchTimer=null;

addAlbumButton.addEventListener('click',function(){
    addAlbumModal.style.display='flex';
    albumSearchInput.focus();
});

closeAddAlbum.addEventListener('click',function(){
    addAlbumModal.style.display='none';
    albumSearchInput.value='';
    albumSearchResults.innerHTML='';
});

addAlbumModal.addEventListener('click',function(event){
    if(event.target===addAlbumModal){
        addAlbumModal.style.display='none';
        albumSearchInput.value='';
        albumSearchResults.innerHTML='';
    }
});

albumSearchInput.addEventListener('input',function(){
    const query=albumSearchInput.value.trim();

    clearTimeout(searchTimer);

    if(query.length<2){
        if(musicBrainzController){
            musicBrainzController.abort();
        }

        albumSearchResults.innerHTML='';
        return;
    }

    albumSearchResults.innerHTML='<p>Söker...</p>';

    searchTimer=setTimeout(function(){
        searchMusicBrainz(query);
    },250);
});

function escapeHTML(text){
    return String(text).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}

let musicBrainzController=null;
let musicBrainzSearchNumber=0;





async function searchMusicBrainz(query){
    const searchNumber=++musicBrainzSearchNumber;

    albumSearchResults.innerHTML='<p>Söker...</p>';

    try{
        const {data,error}=await supabaseClient.functions.invoke('discogs-search',{
            body:{query:query}
        });

        if(error){
            console.error('Discogs error:',error);
            throw error;
        }

        console.log('Discogs results:',data);

        if(searchNumber!==musicBrainzSearchNumber)return;

        albumSearchResults.innerHTML='';

        const results=data&&data.results?data.results:[];

        if(!results.length){
            albumSearchResults.innerHTML='<p>Inga album hittades.</p>';
            return;
        }


        // ========================================
        // 1. ENDAST 12" VINYL
        // ========================================

        const vinylResults=results.filter(function(release){

            const formats=Array.isArray(release.format)
                ?release.format.map(function(format){
                    return String(format).toLowerCase();
                })
                :[];

            const formatText=formats.join(' ');

            // Måste vara Vinyl
            const isVinyl=formats.some(function(format){
                return format.indexOf('vinyl')>-1;
            });

            if(!isVinyl)return false;


            // Måste vara 12"
            const is12Inch=
                formatText.indexOf('12"')>-1 ||
                formatText.indexOf('12 inch')>-1 ||
                formatText.indexOf('12-inch')>-1;

            if(!is12Inch)return false;


            // ========================================
            // 2. TA BORT REMASTERS / REISSUES
            // ========================================

            const blockedWords=[
                'remaster',
                'remastered',
                'reissue',
                'anniversary',
                'deluxe',
                'expanded',
                'box set'
            ];

            const isBlocked=blockedWords.some(function(word){
                return formatText.indexOf(word)>-1;
            });

            if(isBlocked)return false;


            // Kontrollera även titel och eventuell
            // beskrivande information.
            const text=String(
                (release.title||'')+' '+
                (release.notes||'')+' '+
                (release.format_description||'')
            ).toLowerCase();


            const blockedTextWords=[
                'remaster',
                'remastered',
                'reissue',
                'anniversary edition',
                'deluxe edition',
                'expanded edition'
            ];


            const blockedByText=blockedTextWords.some(function(word){
                return text.indexOf(word)>-1;
            });


            if(blockedByText)return false;


            return true;
        });


        if(!vinylResults.length){
            albumSearchResults.innerHTML=
                '<p>Inga relevanta 12" vinylalbum hittades.</p>';
            return;
        }


        // ========================================
        // 3. HÄMTA ARTIST + ALBUMTITEL
        // ========================================

        function getArtist(release){

            const title=String(release.title||'');
            const parts=title.split(' - ');

            if(parts.length>1){
                return parts[0].trim().toLowerCase();
            }

            return '';
        }


        function getAlbumTitle(release){

            const title=String(release.title||'');
            const parts=title.split(' - ');

            if(parts.length>1){
                return parts.slice(1).join(' - ').trim().toLowerCase();
            }

            return title.trim().toLowerCase();
        }


        // ========================================
        // 4. LANDPRIORITET
        //
        // UK först
        // US därefter
        // Europe sist
        // ========================================

        function getCountryPriority(release){

            const country=String(
                release.country||''
            ).toLowerCase().trim();


            if(
                country==='uk' ||
                country==='united kingdom'
            ){
                return 1;
            }


            if(
                country==='us' ||
                country==='usa' ||
                country==='united states'
            ){
                return 2;
            }


            if(
                country==='europe' ||
                country==='eu'
            ){
                return 3;
            }


            return 99;
        }


        // ========================================
        // 5. GRUPPERA SAMMA ALBUM
        // ========================================

        const albumGroups={};


        vinylResults.forEach(function(release){

            const artist=getArtist(release);
            const albumTitle=getAlbumTitle(release);


            if(!albumTitle)return;


            const key=artist+'|'+albumTitle;


            if(!albumGroups[key]){
                albumGroups[key]=[];
            }


            albumGroups[key].push(release);
        });


        // ========================================
        // 6. VÄLJ EN RELEASE PER ALBUM
        // ========================================

        const selectedAlbums=[];


        Object.keys(albumGroups).forEach(function(key){

            const releases=albumGroups[key];


            // ----------------------------------------
            // Först försöker vi UK
            // ----------------------------------------

            let preferred=releases.filter(function(release){
                return getCountryPriority(release)===1;
            });


            // ----------------------------------------
            // Om ingen UK: US
            // ----------------------------------------

            if(!preferred.length){

                preferred=releases.filter(function(release){
                    return getCountryPriority(release)===2;
                });

            }


            // ----------------------------------------
            // Om ingen UK eller US: Europe
            // ----------------------------------------

            if(!preferred.length){

                preferred=releases.filter(function(release){
                    return getCountryPriority(release)===3;
                });

            }


            // ----------------------------------------
            // Om inget av UK/US/Europe finns
            // tar vi INTE en annan region.
            // ----------------------------------------

            if(!preferred.length){
                return;
            }


            // ----------------------------------------
            // Äldsta release först
            // ----------------------------------------

            preferred.sort(function(a,b){

                const yearA=parseInt(a.year,10);
                const yearB=parseInt(b.year,10);


                if(!yearA && !yearB)return 0;
                if(!yearA)return 1;
                if(!yearB)return -1;


                return yearA-yearB;
            });


            // Första = vår bästa kandidat
            selectedAlbums.push(preferred[0]);
        });


        // ========================================
        // 7. SORTERA ALBUMEN
        // ========================================
        //
        // Tidigaste album först.
        // Detta gör exempelvis ABBA-resultaten
        // mer naturliga kronologiskt.
        // ========================================

        selectedAlbums.sort(function(a,b){

            const yearA=parseInt(a.year,10);
            const yearB=parseInt(b.year,10);


            if(!yearA && !yearB)return 0;
            if(!yearA)return 1;
            if(!yearB)return -1;


            return yearA-yearB;
        });


        console.log(
            'Valda album:',
            selectedAlbums
        );


        // ========================================
        // 8. VISA RESULTAT
        // ========================================

        selectedAlbums.slice(0,10).forEach(function(release){

            const title=release.title||'Okänd titel';


            // Discogs brukar returnera:
            // Artist - Album
            const parts=title.split(' - ');


            const artist=parts.length>1
                ?parts[0]
                :'Okänd artist';


            const albumTitle=parts.length>1
                ?parts.slice(1).join(' - ')
                :title;


            const year=release.year||'';

            const country=release.country||'';


            const formats=Array.isArray(release.format)
                ?release.format.join(', ')
                :'';


            const imageUrl=release.thumb||'';


            const div=document.createElement('div');

            div.className='mb-result';


            div.innerHTML=
                (imageUrl
                    ?'<img class="mb-cover" src="'+
                        escapeHTML(imageUrl)+
                        '" alt="" onerror="this.style.display=\'none\'">'
                    :'')+

                '<div class="mb-info">'+

                    '<div class="mb-title">'+
                        escapeHTML(albumTitle)+
                    '</div>'+

                    '<div class="mb-artist">'+
                        escapeHTML(artist)+
                    '</div>'+

                    '<div class="mb-year">'+
                        escapeHTML(String(year))+

                        (country
                            ?' · '+escapeHTML(country)
                            :'')+

                        ' · 12" Vinyl'+

                    '</div>'+

                '</div>'+

                '<button class="mb-add-button">Add</button>';


            const addButton=
                div.querySelector('.mb-add-button');


            addButton.addEventListener(
                'click',
                function(event){

                    event.stopPropagation();


                    console.log(
                        'Valt Discogs-release:',
                        release
                    );


                    addAlbumFromDiscogs(
                        release,
                        artist,
                        albumTitle,
                        year,
                        addButton
                    );
                }
            );


            albumSearchResults.appendChild(div);
        });


        if(!selectedAlbums.length){

            albumSearchResults.innerHTML=
                '<p>Inga relevanta UK-, US- eller Europe-pressningar hittades.</p>';
        }


    }catch(error){

        console.error('Discogs-fel:',error);

        if(searchNumber===musicBrainzSearchNumber){

            albumSearchResults.innerHTML=
                '<p>Kunde inte kontakta Discogs.</p>';
        }
    }
}

async function addAlbumFromMusicBrainz(album,artist,year,button){
    if(button.classList.contains('mb-added'))return;

    button.textContent='Hämtar...';
    button.disabled=true;

    try{
        const url='https://musicbrainz.org/ws/2/release-group/'+album.id+'?inc=releases+artist-credits&fmt=json';

        const response=await fetch(url);

        if(!response.ok)throw new Error('HTTP '+response.status);

        const data=await response.json();

        console.log('MusicBrainz album:',data);

        const releases=data.releases||[];

        if(!releases.length){
            throw new Error('Inga releases hittades');
        }

        const release=releases[0];

        console.log('Vald release:',release);

        const tracksUrl='https://musicbrainz.org/ws/2/release/'+release.id+'?inc=recordings+media&fmt=json';

        const tracksResponse=await fetch(tracksUrl);

        if(!tracksResponse.ok)throw new Error('HTTP '+tracksResponse.status);

        const releaseData=await tracksResponse.json();

        console.log('Release med låtar:',releaseData);

        const tracks=[];

        (releaseData.media||[]).forEach(function(media){
            const side=media.position||1;

            (media.tracks||[]).forEach(function(track){
                tracks.push({
                    side:side,
                    number:track.position||0,
                    title:track.title||''
                });
            });
        });

        const coverUrl='https://coverartarchive.org/release/'+release.id+'/front-1200';

        console.log('Album:',album.title);
        console.log('Artist:',artist);
        console.log('År:',year);
        console.log('Omslag:',coverUrl);
        console.log('Låtar:',tracks);

        button.textContent='✓ Added';
        button.classList.add('mb-added');

    }catch(error){
        console.error('Kunde inte hämta album:',error);

        button.textContent='Add';
        button.disabled=false;

        alert('Kunde inte hämta albuminformationen.');
    }
}
