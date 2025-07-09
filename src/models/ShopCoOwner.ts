import { Table, Column, Model, PrimaryKey, AutoIncrement, DataType, Default, AllowNull, BelongsTo, ForeignKey } from 'sequelize-typescript';
import { Shop } from './Shop';
import { User } from './User';

export type PermissionKey =
    | 'edit_shop_info'
    | 'create_products'
    | 'edit_products'
    | 'refill_products'
    | 'delete_products';

@Table({ tableName: 'shop_co_owners', paranoid: true, updatedAt: false })
export class ShopCoOwner extends Model<ShopCoOwner> {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare id: number;

  @AllowNull(false)
  @Column(DataType.ENUM('pending', 'accepted', 'declined'))
  declare status: string;

  @Default(false)
  @AllowNull(false)
  @Column(DataType.BOOLEAN)
  declare edit_shop_info: boolean;

  @Default(false)
  @AllowNull(false)
  @Column(DataType.BOOLEAN)
  declare create_products: boolean;

  @Default(false)
  @AllowNull(false)
  @Column(DataType.BOOLEAN)
  declare edit_products: boolean;

  @Default(false)
  @AllowNull(false)
  @Column(DataType.BOOLEAN)
  declare refill_products: boolean;

  @Default(false)
  @AllowNull(false)
  @Column(DataType.BOOLEAN)
  declare delete_products: boolean;

  @ForeignKey(() => Shop)
  @AllowNull(false)
  @Column(DataType.INTEGER)
  declare shopId: number;

  @BelongsTo(() => Shop, 'shopId')
  declare shop: Shop;

  @ForeignKey(() => User)
  @AllowNull(false)
  @Column(DataType.INTEGER)
  declare userId: number;

  @BelongsTo(() => User, 'userId')
  declare user: User;
}
