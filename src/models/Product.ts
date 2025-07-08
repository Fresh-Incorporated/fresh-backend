import {
  Table, Column, Model, PrimaryKey, AutoIncrement, DataType, Default, AllowNull, BelongsTo, ForeignKey, HasMany, BelongsToMany
} from 'sequelize-typescript';
import { Shop } from './Shop';
import { ProductHistory } from './ProductHistory';
import { Tag } from './Tag';
import { ProductTag } from './ProductTag';

@Table({ tableName: 'products', paranoid: true, timestamps: true })
export class Product extends Model<Product> {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare id: number;

  @AllowNull(false)
  @Column(DataType.STRING)
  declare name: string;

  @AllowNull(false)
  @Column(DataType.TEXT)
  declare description: string;

  @AllowNull(true)
  @Column(DataType.TEXT)
  declare icon: string | null;

  @AllowNull(false)
  @Column(DataType.SMALLINT)
  declare stack_count: number;

  @AllowNull(false)
  @Column(DataType.SMALLINT)
  declare slots_count: number;

  @AllowNull(false)
  @Column(DataType.DOUBLE)
  declare price: number;

  @Default(0)
  @AllowNull(false)
  @Column(DataType.SMALLINT)
  declare verify_status: number;

  @Default(0)
  @AllowNull(false)
  @Column(DataType.SMALLINT)
  declare refill_status: number;

  @Default(0)
  @AllowNull(false)
  @Column(DataType.INTEGER)
  declare count: number;

  @Default(true)
  @AllowNull(false)
  @Column(DataType.BOOLEAN)
  declare enabled: boolean;

  @ForeignKey(() => Shop)
  @AllowNull(false)
  @Column(DataType.INTEGER)
  declare shopId: number;

  @BelongsTo(() => Shop, 'shopId')
  declare shop: Shop;

  @HasMany(() => ProductHistory, 'productId')
  declare history: ProductHistory[];

  @BelongsToMany(() => Tag, () => ProductTag, 'product_id', 'tag_id')
  declare tags: Tag[];
} 