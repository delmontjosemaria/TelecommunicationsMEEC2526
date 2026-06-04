import Item from '../models/item';
import socketService from '../services/socket.service';

export function startAuctionTimer(): void{
    // Usar setInterval a cada segundo para decrementar todos os items ativos:
    setInterval(async () => {
        try{
            const activeItems = await Item.find({isActive: true, sold: false, remainingtime: {$gt: 0}});
            for (const item of activeItems) {
                item.remainingtime -= 1000;
                if (item.remainingtime <= 0) {
                    item.remainingtime = 0;
                    item.isActive = false;
                    // determinar vencedor e emitir item:sold
                    socketService.itemSoldBroadcast(item);
                }
                else
                    await item.save();
            }
            // emitir update:items com lista atualizada
            socketService.itemsUpdateBroadcast(await Item.find({isActive: true, sold: false}));
        }
        catch(err){
            console.error('Auction timer error: ', err);
        }
    }, 1000);
}
