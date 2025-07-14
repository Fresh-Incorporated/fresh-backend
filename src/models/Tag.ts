import { Table, Column, Model, PrimaryKey, AutoIncrement, DataType, AllowNull, Unique, BelongsToMany } from 'sequelize-typescript';
import { Product } from './Product';
import { ProductTag } from './ProductTag';

@Table({ tableName: 'tags', timestamps: false })
export class Tag extends Model<Tag> {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare id: number;

  @AllowNull(false)
  @Unique
  @Column(DataType.STRING)
  declare name: string;

  @BelongsToMany(() => Product, () => ProductTag, 'tag_id', 'product_id')
  declare products: Product[];
}
