/*export */ class Customer {
    constructor(id, insert_time, modify_time, status,name,phone_number,sign_up_time,we_chatid,base_school_id) {
        this.id = id;
        this.insert_time = insert_time;
        this.modify_time = modify_time;
        this.status = status;
        this.name = name;
        this.phone_number = phone_number;
        this.sign_up_time = sign_up_time;
        this.we_chatid = we_chatid;
        this.base_school_id = base_school_id;
    }
}

module.exports = {
    Customer: Customer
};
