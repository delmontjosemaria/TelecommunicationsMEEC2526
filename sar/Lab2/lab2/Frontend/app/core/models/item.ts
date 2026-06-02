export class Item {
	constructor (
      public id: string,
      public title: string,
      public description: string,
      public currentbid: number,
      public remainingtime: number,
      public buynow: number,
      public wininguser: string,
      public owner: string,
      public reservePrice?: number,
      public sold?: boolean,
      public isActive?: boolean,
      public createdAt?: Date,
      public updatedAt?: Date
	){}
}
