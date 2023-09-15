//import express, { Express, Request, Response } from 'express';
import express, { response } from 'express';
import { PrismaClient } from '@prisma/client';
import cors from 'cors';
import bodyParser from 'body-parser';
import * as got from 'got';
import bcrypt from 'bcrypt';
import nodemailer from 'nodemailer';
import { Server } from 'socket.io';
import * as http from 'http';
import multer from 'multer';
import fs from 'fs';

/*import {
    exchangeCodeForAccessToken,
    exchangeNpssoForCode,
    getTitleTrophies,
    getUserTitles,
    getUserTrophiesEarnedForTitle,
    makeUniversalSearch,
    getBasicPresence,
    getRecentlyPlayedGames,
    getProfileFromUserName,
    TrophyRarity
} from "psn-api";*/
//962157895908076652

/*const accessCode = await exchangeNpssoForCode(process.env.PSN_NPSSO);
const authorization = await exchangeCodeForAccessToken(accessCode);

const presence = await getBasicPresence(
    authorization,
    "xelnia"
);

console.log(presence);*/

const prisma = new PrismaClient();
const upload = multer({ dest: './public/' });
const app = express();
app.use('/public', express.static('public'));
//app.use(express.json()); // For parsing application/json
//app.use(express.urlencoded({ extended: true})); //For parsing application/x-www-form-urlencoded
app.use(cors({origin: "*"}));

/*const socketIO = new Server(http.Server(app), {
    cors: {
        origin: 'http://localhost:3001'
    }
});*/

const HTTP = http.createServer(app);
const io = new Server(HTTP, {
    cors: {
        origin: "*"
    }
});
//64f25f1f73c3829657fe7678
io.on('connection', socket => {
    console.log(`User ${socket.id} just connected`);

    socket.on('enterwaitingroom', (roomname)=>{
        console.log(`User ${socket.id} joined ${roomname}waitingroom`);
        socket.join(roomname+'waitingroom');
    });

    socket.on('removestake', (arg)=>{
        let data = JSON.parse(arg);
        io.to(data.gameid+'waitingroom').emit(data.gameid+'wrupdate', JSON.stringify({username:data.username, userid:data.userid}));
        socket.leave(data.gameid+'waitingroom');       
    });

    socket.on('cancelgame', (gameid)=>{
        io.to(gameid+'waitingroom').emit(gameid+'gamecancelled', '');
    });

    socket.on('startgame', (gameid)=>{
        io.to(gameid+'waitingroom').emit(gameid+'gamestarted', '');
    });

    socket.on('leavewaitingroom', (roomname) => {
        console.log(`User ${socket.id} left ${roomname}waitingroom`);
        socket.leave(roomname+'waitingroom');
    });

    socket.on('enterdecisionroom', (roomname)=>{
        console.log(`User ${socket.id} joined ${roomname}decisionroom`);
        socket.join(roomname+'decisionroom');
    });

    socket.on('DRvote', (arg)=>{
        let data = JSON.parse(arg);
        console.log('DRvote>>>'+data.gameid);
        io.to(data.gameid+'decisionroom').emit(data.gameid+'voteupdate', JSON.stringify({game:data.game}));
    });

    socket.on('wehaveawinner', (arg)=>{
        let data = JSON.parse(arg);
        console.log('In wehavea inner '+data.gameid);
        io.to(data.gameid+'decisionroom').emit(data.gameid+'winner', data.winner);
    });

    socket.on('gamecomplete', (gameid)=>{
        socket.to(gameid+'decisionroom').emit(gameid+'complete', '');
    });

    socket.on('leavedecisionroom', (roomname) => {
        console.log(`User ${socket.id} left ${roomname}decisionroom`);
        socket.leave(roomname+'decisionroom');
    });

    socket.on('disconnect', ()=>{
        console.log(`User ${socket.id} disconnected`);
        socket.disconnect();
    });
});

app.post('/profpicupload', upload.single("profpic"), async (req, res) => {
    //Remove former image
    let user = await prisma.user.findFirst({
        where: {
            userid: req.body.userid
        }
    });

    if(user.profilepic){
        let formerpic = user.profilepic.slice(21);
        console.log('removed>> '+'.'+formerpic);
        fs.rmSync('.'+formerpic);
    }

    //Rename current uploaded image
    fs.renameSync('./public/'+req.file.filename, './public/profpic' + req.body.userid + req.file.originalname.slice(req.file.originalname.lastIndexOf('.')));

    //Update database
    let profpic = 'http://localhost:3000/public/profpic' + req.body.userid + req.file.originalname.slice(req.file.originalname.lastIndexOf('.'));
    let userupdate = await prisma.user.update({
        where: {
            userid: req.body.userid
        },
        data: {
            profilepic: profpic
        }
    });

    res.send({profpic: profpic});
});

app.post('/forgotpassword', bodyParser.json(), async (req, res) => {
    try{
        let passwordhash = await bcrypt.hash(req.body.password, 10);

        let action = await prisma.user.update({
            where: {
                username: req.body.username,
                email: req.body.email
            },
            data: {
                password: passwordhash
            }
        });

        res.send({msg: 'success'});
    }catch(e){
        console.log('Error at /forgotpassword: '+e);
        res.send({msg: 'An error occured while processing, please try again later.'})
    }
});

app.post('/sendemailcode', bodyParser.json(), async (req, res) => {
    //Get userid
    let user = await prisma.user.findFirst({
        where: {
            username: req.body.username,
            email: req.body.email
        }
    });

    let userid = user.userid;

    let randomnum = Math.floor((Math.random() * (999999-100000+1))+100000) //Generates random numbers between 100000 and 999999
    //console.log(process.env.EMAIL_USER+'<>'+process.env.EMAIL_PASSWORD);
    let transporter = nodemailer.createTransport({
        service:'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASSWORD
        },
        tls: {
            rejectUnauthorized: false
        }
    });

    let mailOptions = {
        from: process.env.EMAIL_USER,
        to: req.body.email,
        subject: 'Email Verification',
        html: `<h1><strong>${randomnum}<strong></h1>`
    }

    transporter.sendMail(mailOptions, async (err, info)=>{
        if(err){
            console.log(err);
            res.send({msg:'An error occured try again or use another email'});
        }else{
            console.log('Email sent: '+info.response);
            //Set all other verification codes to this email and userid to cancelled
            let unset = await prisma.emailVerification.updateMany({
                where: {
                    userid: userid,
                    email: req.body.email,
                    state: 'unverified'
                },
                data: {
                    state:'cancelled'
                }
            });

            let email = await prisma.emailVerification.create({
                data:{
                    userid: userid,
                    email: req.body.email,
                    state: 'unverified',
                    code: randomnum.toString()
                }
            })

            res.send({msg:'A code has been sent to this email'});
        }
    });
});

app.post('/passwordverifyemail', bodyParser.json(), async (req, res) => {
    let user = await prisma.user.findFirst({
        where: {
            username: req.body.username,
            email: req.body.email
        }
    });



    let coderow = await prisma.emailVerification.findFirst({
        where:{
            userid: user.userid,
            email: req.body.email,
            code: req.body.code,
            state: 'unverified'
        }
    });

    if(coderow){
        let start = parseInt(coderow.timesent.toString().split(':')[1]);
        let current = new Date().getMinutes();
        if(current>=start+4){
            //Change the row to cancelled
            let updaterow = await prisma.emailVerification.updateMany({
                where:{
                    userid: user.userid,
                    email: req.body.email,
                    code: req.body.code,
                    state: 'unverified'
                },
                data:{
                    state:'cancelled'
                }
            });

            res.send({msg:'This code has expired'});   
        }else{
            //Change the row to verified and update the user email
            let updaterow = await prisma.emailVerification.updateMany({
                where:{
                    userid: user.userid,
                    email: req.body.email,
                    code: req.body.code,
                    state: 'unverified'
                },
                data:{
                    state:'verified'
                }
            });

            res.send({msg:'Email verified'})
        }
        console.log(coderow);
    }else{
        res.send({msg:'Invalid 6 digit code'});
    }
});

app.post('/passwordchangepossible', bodyParser.json(), async (req, res) => {
    try{
        let user = await prisma.user.findFirst({
            where: {
                username: req.body.username
            }
        });

        if(user){
            if(user.email){
                res.send({msg: 'success', data: {username:user.username, email:user.email}});
            }else{
                res.send({msg: 'Account does not have a verified email. Please contact customer support.'});
            }
        }else{
            res.send({msg: 'Username does not exist'});
        }
    }catch(e){
        res.send({msg: 'An error occured while processing, please try again later'});
    }
});

app.post("/loginauthentication", bodyParser.json(), async (req, res)=>{
    console.log(req.body);
    let user = await prisma.user.findFirst({
        where:{
            email:{
                equals:req.body.email
            }
        }
    });

    console.log(user);

    if(user){
        res.send({ data: user});
    }else{
        let action = await prisma.user.create({
            data: {
                name: req.body.name,
                email: req.body.email,
                picture: req.body.picture,
                wallet: '0'
            }
        });
        console.log(action);
        res.send({ data: action});
    }
});



app.post("/loginaccount", bodyParser.json(), async (req, res)=>{
    console.log(req.body);
    
    let user = await prisma.user.findFirst({
        where:{
            username:{
                equals:req.body.username
            }
        }
    });

    if(user){
        let result = await bcrypt.compare(req.body.password, user.password)

        console.log(result);

        if(result){
            delete user.password;
            res.send({ 
                data: user, 
                msg:'200'
            });
        }else{
            res.send({ data: null, msg:'Wrong credentials'});
        }
    }else{
        res.send({ data: null, msg:'Username does not exist'});
    }
});


app.post('/createaccount', bodyParser.json(), async (req, res) => {
    console.log(req.body);
    let user = await prisma.user.findFirst({
        where:{
            username: req.body.username
        }
    });

    console.log('simi'+user);

    if(user){
        res.send({ data:null, msg: 'Username already exists' });
    }else{
        //Hash password
        let passwordhash = await bcrypt.hash(req.body.password, 10);

        let action = await prisma.user.create({
            data: {
                username: req.body.username,
                password: passwordhash,
                wallet: '0'
            }
        });
        console.log(action);
        delete action.password;
        res.send({ data: action, msg:'200'});
    }
});



app.post('/getuserdata', bodyParser.json(), async (req, res)=>{
    let user = await prisma.user.findFirst({
        where: {
            userid: req.body.userid
        },
        include:{
            gamescreated: false
        }
    });
    

    console.log(user);
    delete user.password;
    res.send({data: user});   
})

app.post('/getuserdatawithgames', bodyParser.json(), async (req, res)=>{
    let user = await prisma.user.findFirst({
        where: {
            userid: req.body.userid
        },
        include:{
            gamescreated: true
        }
    });
    
    
    console.log(user);
    delete user.password;
    res.send({data: user});   
})



app.post('/flwdeposit', bodyParser.json(), async (req, res)=>{
    try {
        console.log(req.body);
        let payload = {
            tx_ref: req.body.ref,
            amount: req.body.amount,
            currency: "NGN",
            redirect_url: "http://localhost:3000/depositconfirmation",
            customer: {
                email: req.body.data.email,
                name: req.body.data.fullname
            },
            customizations: {
                title: "PacPlay Deposit",
                logo: "http://www.piedpiper.com/app/themes/joystick-v27/images/logo.png"
            }
        }
        
        fetch(
            "https://api.flutterwave.com/v3/payments",
            {
                method: 'POST',
                body: JSON.stringify(payload),
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.FLW_SECRET_KEY}` }
            }  
        ).then(response=>{
            return response.json();
        }).then(async response=>{
            let url = response;

            let tx_details = await prisma.deposit.create({
                data: {
                    txref: req.body.ref,
                    ownerid: req.body.data.userid,
                    amount: (req.body.amount).toString(),
                    status: 'pending'
                }
            });

            console.log(url);
            res.send({url: url});
        });

    } catch (err) {
        let msg = 'Error: '+err;
        console.log(msg);
        res.send({data:null, msg: msg});
    }
});



app.get('/depositconfirmation', async (req, res)=>{
    console.log(req.query);
    if(req.query.status==='successful' || req.query.status==='completed'){
        //Set the transaction record to successful
        try{
            let tx_edit = await prisma.deposit.update({
                where: {
                    txref: req.query.tx_ref
                },
                data: {
                    status: req.query.status
                }
            });

            //Update user wallet
            let user = await prisma.user.findFirst({
                where: {
                    userid: tx_edit.ownerid
                },
            });
            
            let newbalance = ( parseInt(user.wallet) + parseInt(tx_edit.amount) ).toString();

            let walletUpdate = await prisma.user.update({
                where: {
                    userid: tx_edit.ownerid
                },
                data: {
                    wallet: newbalance
                }
            });

            console.log('Update complete')
            res.send({msg:"Deposit Successful. Return to app and check your wallet..."});
        }catch(err){
            console.log('Error occurred during wallet update')
            console.log(err);
        }

    }else{
        //Set the transaction record to cancelled
        let tx_edit = await prisma.deposit.update({
            where: {
                txref: req.query.tx_ref
            },
            data: {
                status: req.query.status
            }
        });

        res.send({msg:"Deposit Unsuccessful. Return to app..."});
    }
});


app.post('/editfullname', bodyParser.json(), async (req, res)=>{
    try{
        let editteduser = await prisma.user.update({
            where:{
                userid: req.body.userid
            },
            data:{
                fullname: req.body.fullname
            }
        });
    
        res.send({msg:'success'});
    }catch(err){
        console.log(err);
        res.send({msg:'failed'});
    }
});


app.post('/editusername', bodyParser.json(), async (req, res)=>{
    try{
        //Check if there is already a user with that username they want to change to
        let similaruser = await prisma.user.findFirst({
            where: {
                username: req.body.username
            }
        });

        if(similaruser){
            res.send({msg: 'A user already exists with that username'});
        }else{
            let editteduser = await prisma.user.update({
                where:{
                    userid: req.body.userid
                },
                data:{
                    username: req.body.username
                }
            });

            if(editteduser){
                res.send({msg:'success'});
            }else{
                res.send({msg:'An error occured'});
            }
        }
    }catch(err){
        console.log(err);
        res.send({msg:'An error occured'});
    }
});

app.post('/verifyemail', bodyParser.json(), async (req, res)=>{
    let randomnum = Math.floor((Math.random() * (999999-100000+1))+100000) //Generates random numbers between 100000 and 999999
    console.log(process.env.EMAIL_USER+'<>'+process.env.EMAIL_PASSWORD);
    let transporter = nodemailer.createTransport({
        service:'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASSWORD
        },
        tls: {
            rejectUnauthorized: false
        }
    });

    let mailOptions = {
        from: process.env.EMAIL_USER,
        to: req.body.email,
        subject: 'Email Verification',
        html: `<h1><strong>${randomnum}<strong></h1>`
    }

    transporter.sendMail(mailOptions, async (err, info)=>{
        if(err){
            console.log(err);
            res.send({msg:'An error occured try again or use another email'});
        }else{
            console.log('Email sent: '+info.response);
            //Set all other verification codes to this email and userid to cancelled
            let unset = await prisma.emailVerification.updateMany({
                where: {
                    userid: req.body.userid,
                    email: req.body.email,
                    state: 'unverified'
                },
                data: {
                    state:'cancelled'
                }
            });

            let email = await prisma.emailVerification.create({
                data:{
                    userid: req.body.userid,
                    email: req.body.email,
                    state: 'unverified',
                    code: randomnum.toString()
                }
            })

            res.send({msg:'A code has been sent to this email'});
        }
    });
});

app.post('/verifyemailcode', bodyParser.json(), async (req, res)=>{
    let coderow = await prisma.emailVerification.findFirst({
        where:{
            userid: req.body.userid,
            email: req.body.email,
            code: req.body.code,
            state: 'unverified'
        }
    });

    if(coderow){
        let start = parseInt(coderow.timesent.toString().split(':')[1]);
        let current = new Date().getMinutes();
        if(current>=start+4){
            //Change the row to cancelled
            let updaterow = await prisma.emailVerification.updateMany({
                where:{
                    userid: req.body.userid,
                    email: req.body.email,
                    code: req.body.code,
                    state: 'unverified'
                },
                data:{
                    state:'cancelled'
                }
            });

            res.send({msg:'This code has expired'});   
        }else{
            //Change the row to verified and update the user email
            let updaterow = await prisma.emailVerification.updateMany({
                where:{
                    userid: req.body.userid,
                    email: req.body.email,
                    code: req.body.code,
                    state: 'unverified'
                },
                data:{
                    state:'verified'
                }
            });

            let updateuseremail = await prisma.user.update({
                where:{
                    userid: req.body.userid,
                },
                data:{
                    email:req.body.email
                }
            });

            res.send({msg:'Email verified'})
        }
        console.log(coderow);
    }else{
        res.send({msg:'Invalid 6 digit code'});
    }
});

app.post('/changepassword', bodyParser.json(), async (req, res)=>{
    let user = await prisma.user.findFirst({
        where:{
            userid: req.body.userid
        }
    });

    let result = await bcrypt.compare(req.body.currentpass, user.password)

    if(result){
        let passwordhash = await bcrypt.hash(req.body.newpass, 10);

        let action = await prisma.user.update({
            where: {
                userid: req.body.userid
            },
            data: {
                password: passwordhash
            }
        });

        if(action){
            res.send({msg:'success'});
        }else{
            res.send({msg:'Something went wrong. Try again later'});
        }

    }else{
        res.send({msg:'Wrong password for this user'});
    }
});

app.post('/withdrawalconfirmation', bodyParser.json(), (req, res) => {
    console.log('confirmed');
});

app.post('/withdraw', bodyParser.json(), (req, res) => {
    console.log(req.body);

    let payload = {
        tx_ref: req.body.ref,
        amount: parseInt(req.body.amount),
        currency: parseInt("NGN"),
        narration: "Pacplay withdrawal",
        redirect_url: "http://localhost:3000/withdrawalconfirmation",
        account_number: req.body.accountnumber,//'0690000040',
        account_bank: req.body.code,//'044',
    }
    
    try{
        fetch(
            "https://api.flutterwave.com/v3/transfers",
            {
                method: 'POST',
                body: JSON.stringify(payload),
                headers: { 'Content-Type': 'application/json', 'Authorization': /*'Bearer FLWSECK_TEST-SANDBOXDEMOKEY-X'*/`Bearer ${process.env.FLW_SECRET_KEY}` }
            }  
        ).then(response=>{
            return response.json();
        }).then(async response=>{
            let url = response;
            console.log(response);

            /*let tx_details = await prisma.deposit.create({
                data: {
                    txref: req.body.ref,
                    ownerid: req.body.data.userid,
                    amount: (req.body.amount).toString(),
                    status: 'pending'
                }
            });

            console.log(url);
            res.send({url: url});*/
        });

    } catch (err) {
        let msg = 'Error: '+err;
        console.log(msg);
        res.send({data:null, msg: msg});
    }

});

app.post('/loadbanks', bodyParser.json(), (req, res) => {
    try{
        fetch(req.body.url, 
        {
            method: 'GET',
            headers: {
                'Authorization': 'Bearer FLWSECK_TEST-SANDBOXDEMOKEY-X'
            }
        }).then(response=>{
            return response.json();
        }).then(response=>{
            console.log(response);
            res.send({msg:'success', banks:response});
        });

    }catch(e){
        console.log(e);
        res.send({msg:'Could not fetch banks from this location'});
    }
});

app.post('/billcategory', bodyParser.json(), (req, res)=>{
    fetch(req.body.url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.FLW_SECRET_KEY}` }
    } ).then(response => {
        return response.json();
    }).then(response => {
        res.send({data: response});
    });
});

app.post('/paybill', bodyParser.json(), (req, res)=>{
    console.log(req.body);
    try{
        fetch(
            "https://api.flutterwave.com/v3/bills",
            {
                method: 'POST',
                body: JSON.stringify(req.body),
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.FLW_SECRET_KEY}` }
            }  
        ).then(response=>{
            return response.json();
        }).then(async response=>{
            //IF THIS IS SUCCESSFUL DEDUCT FROM USER WALLET... AND SEND DETAIL TO THE MOBILE

            res.send({data: response});
            /*let url = response;
            console.log(response);*/
        });
    }catch(e){
        console.log('Error>>>');
        console.log(e);
    }
    
});

app.post('/deposithistory', bodyParser.json(), async (req, res) => {
    try{
        let userdeposits = await prisma.deposit.findMany({
            where: {
                userid: req.body.userid
            }
        });

        res.send({msg:'success', data: userdeposits});
    }catch(e){
        console.log(e);
        res.send({msg:'An error occured while retrieving transaction history, try again later.'});
    }
    
});

app.post('/withdrawalhistory', bodyParser.json(), async (req, res) => {
    try{
        let userwithdrawal = await prisma.withdrawal.findMany({
            where: {
                userid: req.body.userid
            }
        });

        res.send({msg:'success', data: userwithdrawal});
    }catch(e){
        console.log(e);
        res.send({msg:'An error occured while retrieving transaction history, try again later.'});
    }
});


app.post('/creategame', bodyParser.json(), async (req, res)=>{
    let payload = req.body;
    payload.status = 'pending';
    payload.wagersidlist = [payload.creatorid];
    payload.wagerschoices = ['I win'];
    payload.availablewagers = ['head2head'];
    payload.history = [payload.creator+' created the game', payload.creator+' staked NGN '+payload.stake]
    
    try{
        let game = await prisma.game.create({
            data: {
                gametitle: payload.gametitle,
                gamedesc: payload.gamedesc,
                status: payload.status,
                stake: payload.stake,
                creatorid: payload.creatorid,
                bettype: payload.bettype,
                wagersidlist: payload.wagersidlist,
                wagerschoices: payload.wagerschoices,
                availablewagers: payload.availablewagers,
                history: payload.history 
            }
        });

        //Update user wallet and games played
        let user = await prisma.user.findFirst({
            where: {
                userid: payload.creatorid
            }
        });

        let newbalance = (parseInt(user.wallet)-parseInt(payload.stake)).toString();
        user.gameidsplayed.push(game.gameid);

        let update =  await prisma.user.update({
            where: {
                userid: payload.creatorid,
            },
            data: {
                wallet: newbalance,
                gameidsplayed: user.gameidsplayed
            }
        });
        
        res.send({msg:'success', gameid: game.gameid});
    }catch(e){
        res.send({msg:e});
    }
});

app.post('/loadgame', bodyParser.json(), async (req, res)=>{
    console.log(req.body.gameid);
    try{
        let game = await prisma.game.findFirst({
            where: {
                gameid: req.body.gameid,
                status: 'pending'
            },
            include:{
                creator: true
            }
        });

        console.log(game);
        game.creatorname = game.creator.username;
        delete game.creator;
        
        if(game){
            res.send({msg:'success', game:game});
        }else{
            res.send({msg:'No open game exists with that ID'});
        }

    }catch(e){
        console.log(e);
        res.send({msg: 'An error occured while loading game, please check if the ID sent is correct and try again'});
    }
});


app.post('/stake', bodyParser.json(), async (req, res)=>{
    let game = await prisma.game.findFirst({
        where: {
            gameid: req.body.gameid,
            status: 'pending'
        }
    });

    console.log(game);

    if(game){
        let wagersidlist = game.wagersidlist;
        let wagerschoices = game.wagerschoices;
        let history = game.history;

        wagersidlist.push(req.body.userid);

        if(game.bettype==='h2h'){
            wagerschoices.push('I win');
        }else{
            wagerschoices.push(req.body.mystake);
        }

        
        history.push(req.body.username+' staked NGN '+game.stake);
        
        try{
            let stake = await prisma.game.update({
                where: {
                    gameid: req.body.gameid
                },
                data: {
                    wagersidlist: wagersidlist,
                    wagerschoices: wagerschoices,
                    history: history
                }
            });

            //Update wallet balance by deducting stake & also update gamesplayed
            let user = await prisma.user.findFirst({
                where: {
                    userid: req.body.userid
                }
            });

            let newbalance = (parseInt(user.wallet) - parseInt(game.stake)).toString();
            user.gameidsplayed.push(game.gameid);
            
            let update = await prisma.user.update({
                where: {
                    userid: req.body.userid
                },
                data: {
                    wallet: newbalance,
                    gameidsplayed: user.gameidsplayed
                }
            });

            res.send({msg: 'success'});
            //Emit this to the people in the game
            if(game.bettype === 'h2h'){
                io.to(game.gameid+'waitingroom').emit(game.gameid+'newstake', JSON.stringify({username:user.username, userid:user.userid}));
            }else{
                io.to(game.gameid+'waitingroom').emit(game.gameid+'newstake', JSON.stringify({username:user.username, userid:user.userid, stake:req.body.mystake}));
            }
        }catch(e){
            console.log(e);
            res.send({msg: 'An error occured while staking, please try again later'});
        }
    
    }else{
        res.send({msg:'An error occured while staking, please try again later'});    
    }
});

app.post('/wrimpostercheck', bodyParser.json(), async (req, res)=>{
    let game = await prisma.game.findFirst({
        where: {
            gameid: req.body.gameid,
            status: 'pending'
        }
    });

    let userdata = await prisma.user.findFirst({
        where: {
            userid: req.body.userid
        }
    });

    if(game){
        if(game.wagersidlist.includes(req.body.userid)){
            let playersId = game.wagersidlist;
            let wagerNames = [];

            //Get the names of the players in the wager
            for(let i=0; i<playersId.length; i++){
                let name = await prisma.user.findFirst({
                    where: {
                        userid: playersId[i]
                    }
                });

                wagerNames.push(name.username);
            }

            


            res.send({imposter: false, data: userdata, game: game, wagerNames: wagerNames});
        }else{
            res.send({imposter: true});
        }
    }else{
        res.send({imposter: true});
    }
});

app.post('/removestake', bodyParser.json(), async (req, res) => {
    //User details
    let user = await prisma.user.findFirst({
        where: {
            userid: req.body.userid
        }
    })

    //Database actions
    let game = await prisma.game.findFirst({
        where: {
            gameid: req.body.gameid,
            status: 'pending'
        }
    });

    if(game){
        let index = game.wagersidlist.indexOf(user.userid);
        let wagersidlist = game.wagersidlist.includes(user.userid) ? game.wagersidlist.splice(index,1) : game.wagersidlist;
        let wagerschoices = game.wagersidlist.includes(user.userid) ? game.wagerschoices.splice(index,1) : game.wagerschoices;
        let history = game.wagersidlist.includes(user.userid) ? game.history.push(user.username+' withdrew his stake') : game.history;

        try{
            if(game.wagersidlist.includes(user.userid)){
                //Update the database info for thata game
                let dbaction1 = await prisma.game.update({
                    where: {
                        gameid: req.body.gameid
                    },
                    data: {
                        wagersidlist: game.wagersidlist,
                        wagerschoices: game.wagerschoices,
                        history: game.history
                    }
                });

                //Update user wallet by giving back his/her money and update gameidsplayed
                let newbalance = (parseInt(user.wallet)+parseInt(game.stake)).toString();
                
                if(user.gameidsplayed.includes(game.gameid)){
                    let index2 = user.gameidsplayed.indexOf(game.gameid);
                    user.gameidsplayed.splice(index2, 1);
                }

                let useraction = await prisma.user.update({
                    where: {
                        userid: req.body.userid
                    },
                    data: {
                        wallet:newbalance,
                        gameidsplayed: user.gameidsplayed
                    }
                });
                
                res.send({msg:'success', username:user.username});
            }else{
                console.log('index');
                res.send({msg:'An error occured, please try again'})
            }
            
        }catch(e){
            console.log('Error in /stake: '+e);
            res.send({msg:'An error occured, please try again'})
        }
        
    }else{
        console.log('game');
        res.send({msg:'An error occured, please try again'})
    }

});

app.post('/cancelgame', bodyParser.json(), async (req, res)=>{
    try{
        //Update game details
        let gameupdate = await prisma.game.update({
            where: {
                gameid: req.body.gameid,
                status: 'pending'
            },

            data: {
                status: 'cancelled',
            }
        });

        if(gameupdate){
            //Update the wallets of all the wagerers in the game and the gameidsplayed
            let wagersidlist = gameupdate.wagersidlist;
            for(let i=0; i<wagersidlist.length; i++){
                let user = await prisma.user.findFirst({
                    where: {
                        userid: wagersidlist[i],
                    }
                });
                
                let newbalance = (parseInt(gameupdate.stake)+parseInt(user.wallet)).toString();
                
                if(user.gameidsplayed.includes(req.body.gameid)){
                    let index = user.gameidsplayed.indexOf(req.body.gameid);
                    user.gameidsplayed.splice(index, 1);
                }
                
                let walletupdate = await prisma.user.update({
                    where: {
                        userid: wagersidlist[i]
                    },
                    data: {
                        wallet: newbalance,
                        gameidsplayed: user.gameidsplayed
                    }
                });
            }

            res.send({msg:'success'});
        }else{
            res.send({msg: 'An error occured, this game is currently unavailable.'});    
        }
    }catch(e){
        console.log('Error at /cancelgame '+e);
        res.send({msg: 'An error occured, please try again.'})
    }
});

app.post('/startgame', bodyParser.json(), async (req, res)=>{
    try{
        let game = await prisma.game.update({
            where: {
                gameid: req.body.gameid,
                status: 'pending'
            },
            data: {
                status: 'started'
            }
        });

        if(game){
            res.send({msg:'success'});
        }else{
            res.send({msg: 'An error occured, please try again.'});
        }

    }catch(e){
        res.send({msg: 'An error occured, please try again.'});
    }
});

app.post('/drimpostercheck', bodyParser.json(), async (req, res)=>{
    try{
        let game = await prisma.game.findFirst({
            where: {
                gameid: req.body.gameid,
                status: 'started'
            }
        });
        console.log(game);
        if(game.wagersidlist.includes(req.body.userid)){
            console.log(req.body.userid);
            let user = await prisma.user.findFirst({
                where: {
                    userid: req.body.userid
                }
            });

            let winner = '';
            let votewarning = '';
            //Check if there is already a winner or give a warning if the two choices are incoherent
            if(game.votes.filter(x=>x!=='').length===2){
                if(game.votes[0]===game.votes[1]){
                    if(game.votes[0]==='3'){
                        winner = 'draw';
                    }else{
                        let winnerUser = await prisma.user.findFirst({
                            where: {
                                userid: game.wagersidlist[parseInt(game.votes[0])-1]
                            }
                        });
                        winner = winnerUser.username;
                    }
                }else{
                    votewarning = 'Please both parties should have an agreement on the winner';
                }
            }
    
            res.send({imposter:false, game:game, user:user, winner: winner, votewarning: votewarning});
        }else{
            res.send({imposter: true});
        }
    }catch(e){
        console.log('Error at /drimpostercheck: '+e);
        res.send({imposter: true}); //Set the user as an imposter
    }
});

app.post('/getallbets', bodyParser.json(), async (req, res) => {
    try{
        let user = await prisma.user.findFirst({
            where: {
                userid: req.body.userid
            },
            include: {
                gamesplayed: true
            }
        });
    
        res.send({msg: 'success', data: user});
    }catch(e){
        console.log('Error occured in /getallbets: '+e);
        res.send({msg:'An error occured while loading, please try again.'});
    }
});

app.post('/getspecificbetdetails', bodyParser.json(), async (req, res)=>{
    try{
        let game = await prisma.game.findFirst({
            where: {
                gameid: req.body.gameid,
                status: 'completed'
            },
            include: {
                creator: true,
                stakerslist: true
            }
        });

        res.send({msg:'success', gamedetails: game});
    }catch(e){
        console.log('An error occured in /getspecificbetdetails: '+e);
        res.send({msg:'An error occured while loading, please try again.'});
    }
});

app.post('/vote', bodyParser.json(), async (req, res) => {
    try{
        let game = await prisma.game.findFirst({
            where: {
                gameid: req.body.gameid,
                status: 'started'
            }
        });
    
        if(game){
            let votes = game.votes;
            let votewarning = '';
            let winner = '';
    
            //1 is a win for the creator, 2 is a win for the opponent and 3 is a draw
            if(req.body.userid === game.creatorid){ //creator
                if(req.body.vote === 'I won'){
                    votes[0] = '1';
                }
    
                if(req.body.vote === 'Opponent won'){
                    votes[0] = '2';
                }
    
                if(req.body.vote === 'Draw'){
                    votes[0] = '3';
                }
            }else{ //Not creator
                if(req.body.vote === 'I won'){
                    votes[1] = '2';
                }
    
                if(req.body.vote === 'Opponent won'){
                    votes[1] = '1';
                }
    
                if(req.body.vote === 'Draw'){
                    votes[1] = '3';
                }
            }
            console.log(votes.filter(x=>x!=='').length);
            if(votes.filter(x=>x!=='').length===2){
                if(votes[0]===votes[1]){
                    votewarning = 'We have a winner';
                    
                    if(votes[0]==='3'){
                        winner = 'draw';
                    }else{
                        let winnerUser = await prisma.user.findFirst({
                            where: {
                                userid: game.wagersidlist[parseInt(votes[0])-1]
                            }
                        });
                        winner = winnerUser.username;
                    }

                }else{
                    votewarning = 'Please both parties should have an agreement on the winner';
                }
            }
    
            let gameupdate = await prisma.game.update({
                where: {
                    gameid: game.gameid
                },
                data: {
                    votes: votes
                }
            });

            
            res.send({msg:'success', game: gameupdate, votewarning:votewarning, winner:winner});
        }else{
            console.log('No such game at /vote');
            res.send({msg: 'An error occured, pls try again later'});
        }
    }catch(e){
        console.log('Error @ /vote: '+e);
        res.send({msg:'An error occured, please try again'})
    }
});

app.post('/cancelvote', bodyParser.json(), async (req, res) => {
    console.log('hey');
    try{
        let game = await prisma.game.findFirst({
            where: {
                gameid: req.body.gameid,
                status: 'started'
            }
        });

        if(game){
            let votes = game.votes;
            let index = game.wagersidlist.indexOf(req.body.userid);
            votes[index] = '';
            
            let gameupdate = await prisma.game.update({
                where: {
                    gameid: game.gameid
                },
                data: {
                    votes: votes
                }
            });
            console.log('cancelvote');
            res.send({msg:'success', game: gameupdate});
        }else{
            console.log('No such game @ /cancelvote');
            res.send({msg:'An error occured, please try again'}) 
        }
          
    }catch(e){
        console.log('Error @ /vote: '+e);
        res.send({msg:'An error occured, please try again'})
    }
});

app.post('/disagree', bodyParser.json(), async (req, res) => {
    let gameupdate = await prisma.game.update({
        where: {
            gameid: req.body.gameid,
            status:'started'
        },
        data: {
            agreement: [false, false]
        }
    });
    io.to(req.body.gameid+'decisionroom').emit(req.body.gameid+'disagreement', '');
});

app.post('/agree', bodyParser.json(), async (req, res) => {
    let game = await prisma.game.findFirst({
        where: {
            gameid: req.body.gameid,
            status: 'started'
        },
        include: {
            stakerslist: true
        }
    });

    let index = game.wagersidlist.indexOf(req.body.userid);
    let agreement = game.agreement;
    agreement[index] = true;

    if(agreement[0]===true && agreement[1]===true){
        //Set this game to completed, share the cash and lets gtfooh
        let gameupdate = await prisma.game.update({
            where: {
                gameid: req.body.gameid,
                status: 'started'
            },
            data: {
                status: 'completed',
                agreement: agreement
            }
        });

        let winner = '';
        if(game.votes[0]===game.votes[1] && game.votes[0]==='3'){//This is a draw and in this case you share 90% of the toal stake since Pac has already taken 10%
            let totalwin = parseInt( Math.floor( ( (parseInt(game.stake)*2) - (parseInt(game.stake)*0.2) )/0.5 ));

            for(let i=0; i<game.stakerslist.length; i++){
                let newbalance = ( parseInt(game.stakerslist[i].wallet) + totalwin ).toString();
                let userupdate = await prisma.user.update({
                    where: {
                        userid: game.stakerslist[i].userid
                    },
                    data: {
                        wallet: newbalance
                    }
                });
            }
        }else{ //In this case the winner takes 90% and edit the gameswon and gameslost section
            let totalwin =  parseInt(Math.floor( (parseInt(game.stake)*2) - (parseInt(game.stake)*0.2) ));

            let winnerindex = '';
            if(game.votes[0]===game.votes[1] && game.votes[1]!==''){
                //Reverse the stakers array an use, for some reason the stakerslist returns the users but in the reverse order of the wagersidlist
                let stakerslist = game.stakerslist.reverse();

                winnerindex = parseInt(game.votes[0])-1;

                let newbalance = ( parseInt(stakerslist[winnerindex].wallet) + totalwin ).toString();
                let gameswon = stakerslist[winnerindex].gameswon++;
                
                let userupdate = await prisma.user.update({
                    where: {
                        userid: stakerslist[winnerindex].userid
                    },
                    data: {
                        wallet: newbalance,
                        gameswon: gameswon
                    }
                });

                //Now edit the loser's games lost
                let loserindex = winnerindex===0 ? 1 : 0;
                let gameslost = stakerslist[loserindex].gameslost++;

                let userupdate2 = await prisma.user.update({
                    where: {
                        userid: stakerslist[loserindex].userid
                    },
                    data: {
                        gameslost: gameslost
                    }
                });
            }
        }

        res.send({msg:'complete'});
    
    }else{
        
        let gameupdate = await prisma.game.update({
            where: {
                gameid: req.body.gameid,
                status: 'started'
            },
            data: {
                agreement: agreement
            }
        });
        
        //Tell the other player that you're waiting for his decision
        res.send({msg:'incomplete'});
    }

});


app.post('/creategame2', bodyParser.json(), async (req, res)=>{
    let payload = req.body;
    payload.status = 'pending';
    payload.wagersidlist = [];
    payload.wagerschoices = [];
    payload.history = [payload.creator+' created the game']
    
    try{
        let game = await prisma.game.create({
            data: {
                gametitle: payload.gametitle,
                gamedesc: payload.gamedesc,
                status: payload.status,
                stake: payload.stake,
                creatorid: payload.creatorid,
                bettype: payload.bettype,
                wagersidlist: payload.wagersidlist,
                wagerschoices: payload.wagerschoices,
                availablewagers: payload.availablewagers,
                history: payload.history 
            }
        });

        //Update user wallet and games played
        let user = await prisma.user.findFirst({
            where: {
                userid: payload.creatorid
            }
        });

        user.gameidsplayed.push(game.gameid);

        let update =  await prisma.user.update({
            where: {
                userid: payload.creatorid,
            },
            data: {
                gameidsplayed: user.gameidsplayed
            }
        });

        res.send({msg:'success', gameid: game.gameid});
    }catch(e){
        res.send({msg:e});
    }
});

app.post('/wrimpostercheck2', bodyParser.json(), async (req, res)=>{
    let game = await prisma.game.findFirst({
        where: {
            gameid: req.body.gameid,
            status: 'pending'
        }
    });

    let userdata = await prisma.user.findFirst({
        where: {
            userid: req.body.userid
        }
    });

    if(game){
        //Check first if this user is the creator and in this the admin, cause his/her id won't have to be in the list
        if(req.body.userid === game.creatorid){
            res.send({imposter: false, data: userdata, game: game, accesstype:'admin'});
        }else{
            if(game.wagersidlist.includes(req.body.userid)){
                res.send({imposter: false, data: userdata, game: game, accesstype:'staker'});
            }else{
                res.send({imposter: true});
            }

        }
    }else{
        res.send({imposter: true});
    }
});

app.post('/drimpostercheck2', bodyParser.json(), async (req, res)=>{
    try{
        let game = await prisma.game.findFirst({
            where: {
                gameid: req.body.gameid,
                status: 'started'
            }
        });
        console.log(game);
        if(game.wagersidlist.includes(req.body.userid) || game.creatorid === req.body.userid){//Only if the person is the admin or a staker are they allowed to this link
            console.log(req.body.userid);
            let user = await prisma.user.findFirst({
                where: {
                    userid: req.body.userid
                }
            });

            /*let winner = '';
            let votewarning = '';
            //Check if there is already a winner or give a warning if the two choices are incoherent
            if(game.votes.filter(x=>x!=='').length===2){
                if(game.votes[0]===game.votes[1]){
                    if(game.votes[0]==='3'){
                        winner = 'draw';
                    }else{
                        let winnerUser = await prisma.user.findFirst({
                            where: {
                                userid: game.wagersidlist[parseInt(game.votes[0])-1]
                            }
                        });
                        winner = winnerUser.username;
                    }
                }else{
                    votewarning = 'Please both parties should have an agreement on the winner';
                }
            }*/
    
            res.send({imposter:false, game:game, user:user/*, winner: winner, votewarning: votewarning*/});
        }else{
            res.send({imposter: true});
        }
    }catch(e){
        console.log('Error at /drimpostercheck: '+e);
        res.send({imposter: true}); //Set the user as an imposter
    }
});

app.post('/cancelgame2', bodyParser.json(), async (req, res)=>{
    try{
        //Update game details
        let gameupdate = await prisma.game.update({
            where: {
                gameid: req.body.gameid,
                status: 'pending'
            },

            data: {
                status: 'cancelled',
            }
        });

        if(gameupdate){
            //Update the wallets of all the wagerers in the game and the gameidsplayed
            let wagersidlist = gameupdate.wagersidlist;
            for(let i=0; i<wagersidlist.length; i++){
                let user = await prisma.user.findFirst({
                    where: {
                        userid: wagersidlist[i],
                    }
                });
                
                let newbalance = (parseInt(gameupdate.stake)+parseInt(user.wallet)).toString();
                
                if(user.gameidsplayed.includes(req.body.gameid)){
                    let index = user.gameidsplayed.indexOf(req.body.gameid);
                    user.gameidsplayed.splice(index, 1);
                }
                
                let walletupdate = await prisma.user.update({
                    where: {
                        userid: wagersidlist[i]
                    },
                    data: {
                        wallet: newbalance,
                        gameidsplayed: user.gameidsplayed
                    }
                });
            }

            res.send({msg:'success'});
            io.to(gameupdate.gameid+'decisionroom').emit(gameupdate.gameid+'gamecancelled', '');
        }else{
            res.send({msg: 'An error occured, this game is currently unavailable.'});    
        }
    }catch(e){
        console.log('Error at /cancelgame '+e);
        res.send({msg: 'An error occured, please try again.'})
    }
});

app.post('/admindecision', bodyParser.json(), async (req, res) => {
    try{
        //Update winners wallet, change status to completed, update games lost and won 
        let game = await prisma.game.findFirst({
            where: {
                gameid: req.body.gameid,
                status: 'started'
            },
            include: {
                stakerslist: true
            }
        });

        let decision = game.availablewagers[req.body.decision-1];
        console.log('>>>>'+decision);

        //Update the game
        let gameupdate = await prisma.game.update({
            where: {
                gameid: req.body.gameid,
                status: 'started'
            },
            data: {
                status: 'completed',
                admindecision: decision
            }
        });

        let total = parseInt(game.stake) * game.wagersidlist.length;

        //Give admin 5%
        let admin = await prisma.user.findFirst({
            where:{
                userid: game.creatorid
            }
        });

        let adminbalance = ( parseInt (Math.floor( parseInt(admin.wallet) +  ( total*0.05 ) )) ).toString();
        adminbalance = adminbalance<1 ? 1 : adminbalance; //We are trying to avoid decimals in our wallet

        let adminupdate = await prisma.user.update({
            where: {
                userid: game.creatorid
            },
            data: {
                wallet: adminbalance
            }
        });

        //Update the winners wallets and the games won and lost for each user
        let numOfWinners = game.wagerschoices.filter(x=>x===decision).length;
        let winshare = parseInt( Math.floor( total*0.9 / numOfWinners ));
        winshare = winshare<1 ? 1 : winshare;

        let winners = 0;
        let reducewinshare = false;
        for(let i=0; i<game.stakerslist.length; i++){    
            if(game.wagerschoices[i] === decision){
                winners++;
                if((winshare*(winners))<=(total*0.9)){
                    
                }else{
                    reducewinshare = true;
                }
                
                //Update wallet and update games won
                let value = game.stakerslist[i].gameswon+1;

                if( !reducewinshare ){
                    let balance = ( parseInt(game.stakerslist[i].wallet)+winshare ).toString();
                    console.log('norms>>'+balance);
                    let stakerupdate = await prisma.user.update({
                        where: {
                            userid: game.stakerslist[i].userid
                        },
                        data: {
                            wallet: balance,
                            gameswon: value
                        }
                    });
                }else{//This is where the wins have been completely shared (0.9 of total)...the players would just get back their 0.9 of stake
                    let rems = parseInt(Math.floor(parseInt(game.stake)*0.9));
                    let balance = (parseInt(game.stakerslist[i].wallet) + rems).toString();
                    console.log('rems>>'+balance);
                    let stakerupdate = await prisma.user.update({
                        where: {
                            userid: game.stakerslist[i].userid
                        },
                        data: {
                            gameswon: value,
                            wallet: balance
                        }
                    });
                }
            }else{
                //Update games lost
                let value = game.stakerslist[i].gameslost+1;
                let stakerupdate = await prisma.user.update({
                    where: {
                        userid: game.stakerslist[i].userid
                    },
                    data: {
                        gameslost: value
                    }
                });
            }
        }

        console.log('reached');
        res.send({msg: 'success'});
        io.to(req.body.gameid+'decisionroom').emit(req.body.gameid+'admindecided', '');

    }catch(e){
        console.log(e);
        res.send({msg: 'An error occured while processing, please try again later'});
    }

});

//650156a9aeb0fe67d5f73bc3

app.listen(3000, ()=>{
    console.log('Listening on port 3000...');
});

HTTP.listen(4000, ()=>{
    console.log('HTTP Listening on port 4000...');
});

/*async function main(){
    
    
}


main();
 

/*tx_ref: "hooli-tx-1920bbtytty",
                amount: "100",
                currency: "NGN",
                redirect_url: "https://webhook.site/9d0b00ba-9a69-44fa-a43d-a82c33c36fdc",
                meta: {
                    consumer_id: 23,
                    consumer_mac: "92a3-912ba-1192a"
                },
                customer: {
                    email: "user@gmail.com",
                    phonenumber: "080****4528",
                    name: "Yemi Desola"
                },
                customizations: {
                    title: "Pied Piper Payments",
                    logo: "http://www.piedpiper.com/app/themes/joystick-v27/images/logo.png"
                }*/