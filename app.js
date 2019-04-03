let fs = require('fs');
var url = require('url');
let msg = require('./msg');
let yaml = require('js-yaml');
let crypto = require("crypto");
var log4js = require('log4js');
var multer  = require('multer')
var express = require('express');
var request = require('request');
var sd = require('silly-datetime');
var querystring=require("querystring");
var schedule = require('node-schedule');
var postgresUtil = require('./postgresUtil');
let accessTokenJson = require('./access_token');
let parseString = require('xml2js').parseString;


var app = express();
//加载配置文件
var configDoc = yaml.safeLoad(fs.readFileSync('config.yml', 'utf8'));

//初始化日志
log4js.configure({
  appenders: { xeeyoung: { type: 'file', filename: 'xeeyoung.log' } },
  categories: { default: { appenders: ['xeeyoung'], level: 'all' } }
});
var logger = log4js.getLogger('xeeyoung');

app.post('/server', function(req, res, next){
	//获取客户端IP地址
  var ipAdress = getClientIp(req);
	//提示接受到客户端请求;
  logger.info('有客户端连接|请求IP地址为:' + ipAdress);

	//begin 监听 post 请求数据;
	var buffer = [];
	var postJsonData ="";
	req.on('data', function (data) {
		buffer.push(data);
	});
	req.on('end', function () {
		var reqContentType = req.headers['content-type']; 
		var msgData = Buffer.concat(buffer).toString('utf-8');
		logger.info("POST数据类型: " + reqContentType +" POST数据:" + msgData);
		//判断请求类型/如果为xml
		if(reqContentType==configDoc.sysConfig.contentTypeXml && msgData.trim()!=null){
			//解析XML
			parseString(msgData,{explicitArray : false},function(err,result){
				if(!err){
					//打印解析结果
					logger.info('XML解析成功解析结果;:' +  JSON.stringify(result));
					eventHandle(result.xml,res);
				}else{
					//打印错误信息
					logger.error('XML解析失败');
				}
			});
		}
		res.end();
	});
});

//一般情况仅用于接口验证
app.get('/server', function(req, res, next){
    var arg = url.parse(req.url, true).query;
	var echostr = arg.echostr;
	var timestamp = arg.timestamp;
	var nonce = arg.nonce;
	var signature = arg.signature;

	console.log('微信端签名:' + arg.signature);
	console.log('微信端时间戳:' + arg.timestamp);
	console.log('随机数:' + arg.nonce);
	console.log('随机字符串:' + arg.echostr);
	console.log('消息类型:' + typeof arg);
	console.log('消息内容:' + JSON.stringify(arg));

	if(echostr){
		console.log('echostr不为空,开始校验:' + echostr);
		res.writeHeader(200,{'content-type' : 'text/html;charset="utf-8"'});
		if(check(timestamp,nonce,signature,configDoc.sysConfig.serverToken)){
			res.write(echostr);
		}
	}else{
		res.writeHeader(200,{'content-type' : 'text/html;charset="utf-8"'});
		var time=sd.format(new Date(), 'YYYY-MM-DD HH:mm:ss');
		console.log(time);
		res.write(time);
	}
	res.end();
});

//处理微信登陆鉴权
app.get('/handleAuth', function(req, res, next){
    //鉴权处理开始
	var handleAuthBegin = process.uptime();
    var time=sd.format(new Date(), 'YYYY-MM-DD HH:mm:ss');
	var arg = url.parse(req.url, true).query;
	var userOpenIDData = '权限' + time + "数据 : " +  JSON.stringify(arg);
	getUserOpenId(arg.code).then(userRes => {
		userOpenIDData = userOpenIDData + "UserOpen 数据 : " +  JSON.stringify(userRes);
		logger.info('权限跳转 参数:' + userOpenIDData);
		var redirectUrl = configDoc.sysConfig.baseProUrl + arg.state + userRes.openid;
		logger.info("转发请求地址 : " + redirectUrl);
		res.writeHead(301, {'Location' : redirectUrl});
		res.end();
		var handleAuthEnd = process.uptime();
		logger.info("handleAuth 消耗时间 : " + (handleAuthEnd - handleAuthBegin));
	});
});

app.listen(8089);

logger.info('XEEYOUNG 微信公众号消息处理服务启动成功.');

//获取请求端ip地址;
function getClientIp(req) {
  return req.headers['x-forwarded-for'] ||
         req.connection.remoteAddress ||
         req.socket.remoteAddress ||
         req.connection.socket.remoteAddress;
};

//校验请求合法性
function check(timestamp,nonce,signature,token){
  var currSign,tmp;
  tmp = [token,timestamp,nonce].sort().join("");
  currSign = crypto.createHash("sha1").update(tmp).digest("hex");
  console.log('校验前:' + tmp + ',校验后:' + currSign);
  return (currSign === signature);  
}

//处理微信客户端数据请求
function eventHandle(reqMsg,res){
	switch(reqMsg.MsgType.toLowerCase()){
		case 'event':
			if(reqMsg.Event == "subscribe"){
				logger.info('用户关注');
				//获取accessToken
				getAccessToken().then(function(data){
					logger.info('accessToken = ' + data);   
					createMenu(data,reqMsg.FromUserName); 
				});
				//查询该用户是否 已经登陆系统
				logger.info('发生关注事件：' +  JSON.stringify(reqMsg));
				postgresUtil.select('base_customer',{"we_chatid": reqMsg.FromUserName},[],(res)=>{
					logger.info("select result",res);
					logger.info("当前用户",res.length);
					//如果该用户是第一次注册则新增该用户
					var options={ "we_chatid":reqMsg.FromUserName};
					if(res.length<=0){
						postgresUtil.insert('base_customer',options,(res)=>{
							logger.info("insert result",res);
						});
					}
				});	
			} else if(reqMsg.Event == "unsubscribe"){
				logger.info('用户取消关注');
			}else{
				logger.info('非法事件类型.');
			}
			//回复消息
			//res.write(msg.txtMsg(reqMsg.FromUserName,reqMsg.ToUserName,'欢迎关注'));
			break;
		case 'text':
			logger.info('用户发送文本内容');
			res.send(msg.txtMsg(reqMsg.FromUserName,reqMsg.ToUserName,'欢迎关注上海熙洋信息技术有限公司公众号'));
			break;
    }
}

//获取accessToken
const getAccessToken = function () {
	logger.info('本地凭证是否存在 ' + accessTokenJson.access_token);  
	var currentTime = new Date().getTime();
	//如果本地存储的 凭证为空
	if(accessTokenJson.access_token == undefined || accessTokenJson.expires_time < currentTime){
		logger.info('本地凭证不存在');  
		let queryParams = {
			'grant_type': 'client_credential',
			'appid': configDoc.sysConfig.appid,
			'secret': configDoc.sysConfig.secret
		};
		let wxGetAccessTokenBaseUrl = 'https://api.weixin.qq.com/cgi-bin/token?'+querystring.stringify(queryParams);
		let options = {
			method: 'GET',
			url: wxGetAccessTokenBaseUrl
		};
		return new Promise((resolve, reject) => {
			request(options, function (err, res, body) {
				logger.info('请求新的凭证信息.' + JSON.parse(body));
				var result = JSON.parse(body); 
                if(body.indexOf("errcode") < 0){
                    accessTokenJson.access_token = result.access_token;
                    accessTokenJson.expires_time = new Date().getTime() + (parseInt(result.expires_in) - 200) * 1000;
                    //更新本地存储的
                    fs.writeFile('./access_token.json',JSON.stringify(accessTokenJson),function (err) {
						if(err) {
							console.error(err);
						} else {
							console.log('写入成功');
						}
					});
                    //将获取后的 access_token 返回
                    resolve(accessTokenJson.access_token);
                }else{
                    //将错误返回
                    resolve(result);
                } 
			});
		});
	}else{
        //将本地存储的 access_token 返回
		return new Promise((resolve, reject) => {
			resolve(accessTokenJson.access_token);	
		});
        
    }
};

//获取getUserOpenId
const getUserOpenId = function (code) {
  let queryParams = {
    'grant_type': 'authorization_code',
    'appid': configDoc.sysConfig.appid,
    'secret': configDoc.sysConfig.secret,
	'code':code 
  };
  let wxGetUserOpenId = configDoc.wxApiUrl.accessTokenHandle + querystring.stringify(queryParams);
  let options = {
    method: 'GET',
    url: wxGetUserOpenId
  };
  return new Promise((resolve, reject) => {
    request(options, function (err, res, body) {
      if (res) {
        resolve(JSON.parse(body));
      } else {
        reject(err);
      }
    });
  })
};

//初始化菜单
function createMenu(createMenuToken,openId) {

var menuData = {
  "button": [
    {"name": "熙洋动态",
     "type": "view",
     "url" : "http://www.xeeyoung.cn/wx/wx/company"},
    {"name": "故障报修",
     "sub_button" :[{
        "type":"view",
        "name":"故障报修",
		"url": "https://open.weixin.qq.com/connect/oauth2/authorize?appid=wx97bb63ff6573aeaf&redirect_uri=" + encodeURI("http://www.xeeyoung.cn/handleAuth") + "&response_type=code&scope=snsapi_base&state=" +  encodeURI("createBill/") + "#wechat_redirect"
     },{
        "type":"view",
        "name":"进度查询",
		"url": "https://open.weixin.qq.com/connect/oauth2/authorize?appid=wx97bb63ff6573aeaf&redirect_uri=" + encodeURI("http://www.xeeyoung.cn/handleAuth") + "&response_type=code&scope=snsapi_base&state=" +  encodeURI("customer/billList/") + "#wechat_redirect"
		}
    ]},
    {"name": "管理工单",
     "type": "view",
	 "url": "https://open.weixin.qq.com/connect/oauth2/authorize?appid=wx97bb63ff6573aeaf&redirect_uri=" + encodeURI("http://www.xeeyoung.cn/handleAuth") + "&response_type=code&scope=snsapi_base&state=" +  encodeURI("toLogin/") + "#wechat_redirect"
	}
  ]
};

	logger.info('发送菜单创建请求,请求数据:' + JSON.stringify(menuData));
	let options = {
		url: 'https://api.weixin.qq.com/cgi-bin/menu/create?access_token=' + createMenuToken,
		form: JSON.stringify(menuData),
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded'
		}
	};
	request.post(options, function (err, res, body) {
		if (err) {
			logger.error('发送创建微信公众号菜单失败,错误信息:' + err)
		}else {
			logger.info('发送创建微信公众号菜单成功,反馈信息' + body);
		}
	}) 
}

  //定时任务 用来处理用户消息
function scheduleCronstyle(){
    schedule.scheduleJob('30 * * * * *', function(){
	    logger.info('执行定时任务 每分钟的第30秒执行.');
        postgresUtil.select('message',{"status": "0"},[],(msgRes)=>{
          logger.info('是否有新的消息需要发送：' + JSON.stringify(msgRes));
          if(msgRes.length >=1){
             getAccessToken().then(function(data){
                logger.info('第一条消息:' + msgRes[0]);
                sendMessage(data,msgRes[0]);
             });
          }
        });
    }); 
}

scheduleCronstyle();

//定时发送消息
function sendMessage(createToken,messageArgs){

    var messageData ={
		"touser":messageArgs.touser,
		"template_id":messageArgs.template_id,
		"url":messageArgs.url,  
		"data":JSON.parse(messageArgs.data)
	};

  console.log('messageArgs= ' + JSON.stringify(messageData));
  let options = {
    url: 'https://api.weixin.qq.com/cgi-bin/message/template/send?access_token=' + createToken,
    form: JSON.stringify(messageData),
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  };
  
  request.post(options, function (err, res, body) {
    if (err) {
      console.log(err)
    }else {
      console.log(body);
      //如果发送数据成功 更新消息状态
      postgresUtil.update('message',{"id": messageArgs.id},{"status":1},(res)=>{
        console.log("更新消息成功:",res)
      });
    }
  }); 
}