//import express, { Express, Request, Response } from 'express';
import express, { response } from 'express';
import { PrismaClient } from '@prisma/client';
import cors from 'cors';
import bodyParser from 'body-parser';
import * as got from 'got';
import bcrypt from 'bcrypt';
import nodemailer from 'nodemailer';

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

const prisma = new PrismaClient()
const app = express();
//app.use(express.json()); // For parsing application/json
//app.use(express.urlencoded({ extended: true})); //For parsing application/x-www-form-urlencoded
app.use(cors({origin: "*"}));


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

app.post('/withdraw', bodyParser.json(), (req, res) => {
    console.log(req.body);

    let payload = {
        tx_ref: req.body.ref,
        amount: parseInt(req.body.amount),
        currency: "NGN",
        narration: "Pacplay withdrawal",
        redirect_url: "http://localhost:3000/withdrawalconfirmation",
        account_number: req.body.accountnumber,
        account_bank: req.body.code,
    }
    
    try{
        fetch(
            "https://api.flutterwave.com/v3/transfers",
            {
                method: 'POST',
                body: JSON.stringify(payload),
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.FLW_SECRET_KEY}` }
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
            res.send({msg:'success', banks:response});
        });

    }catch(e){
        console.log(e);
        res.send({msg:'Could not fetch banks from this location'});
    }
});


app.listen(3000, ()=>{
    console.log('Listening on port 3000...');
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