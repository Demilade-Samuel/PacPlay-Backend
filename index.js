//import express, { Express, Request, Response } from 'express';
import express from 'express';
import { PrismaClient } from '@prisma/client';
import cors from 'cors';
import bodyParser from 'body-parser';
import * as got from 'got';

const prisma = new PrismaClient()
const app = express();
//app.use(express.json()); // For parsing application/json
//app.use(express.urlencoded({ extended: true})); //For parsing application/x-www-form-urlencoded
app.use(cors({origin: "*"}));


/*app.post("/loginauthentication", bodyParser.json(), async (req, res)=>{
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
});*/

app.post("/loginaccount", bodyParser.json(), async (req, res)=>{
    console.log(req.body);
    let user = await prisma.user.findFirst({
        where:{
            username:{
                equals:req.body.username
            },
            password:{
                equals:req.body.password
            }
        }
    });

    console.log(user);

    if(user){
        res.send({ data: user, msg:'200'});
    }else{
        res.send({ data: null, msg:'Wrong credentials'});
    }
});

app.post('/createaccount', bodyParser.json(), async (req, res) => {
    console.log(req.body);
    let user = await prisma.user.findFirst({
        where:{
            username:{
                equals:req.body.username
            }
        }
    });

    console.log('simi'+user);

    if(user){
        res.send({ data:null, msg: 'Username already exists' });
    }else{
        let action = await prisma.user.create({
            data: {
                username: req.body.username,
                password: req.body.password,
                wallet: '0'
            }
        });
        console.log(action);
        res.send({ data: action, msg:'200'});
    }
});

app.post('/flwdeposit', async (req, res)=>{
    try {
        const response = await got.post("https://api.flutterwave.com/v3/payments", {
            headers: {
                Authorization: `Bearer ${process.env.FLW_SECRET_KEY}`
            },
            json: {
                tx_ref: req.body.ref,
                amount: req.body.amount,
                currency: "NGN",
                redirect_url: "http://localhost:8081/user/home",
                customer: {
                    email: req.body.data.email,
                    name: req.body.data.name
                },
                customizations: {
                    title: "PacPlay Deposit",
                    logo: "http://www.piedpiper.com/app/themes/joystick-v27/images/logo.png"
                }
            }
        }).json();

        console.log(response);
        res.send({url: response});
    } catch (err) {
        console.log(err.code);
        console.log(err.response.body);
    }
})

app.listen(3000, ()=>{
    console.log('Listening on port 3000...');
})

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