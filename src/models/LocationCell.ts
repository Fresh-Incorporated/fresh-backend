import { Table, Column, Model, PrimaryKey, AutoIncrement, DataType, Default, AllowNull, BelongsTo, ForeignKey } from 'sequelize-typescript';
import { Location } from './Location';

@Table({ tableName: 'location_cells', timestamps: false })
export class LocationCell extends Model<LocationCell> {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.BIGINT)
  declare id: number;

  @AllowNull(true)
  @Column(DataType.STRING)
  declare world: string | null;

  @AllowNull(false)
  @Column(DataType.STRING)
  declare letter: string;

  @AllowNull(false)
  @Column(DataType.INTEGER)
  declare number: number;

  @AllowNull(true)
  @Column(DataType.INTEGER)
  declare x: number | null;

  @AllowNull(true)
  @Column(DataType.INTEGER)
  declare y: number | null;

  @AllowNull(true)
  @Column(DataType.INTEGER)
  declare z: number | null;

  @Default(27)
  @AllowNull(false)
  @Column(DataType.INTEGER)
  declare slots: number;

  @ForeignKey(() => Location)
  @AllowNull(false)
  @Column(DataType.BIGINT)
  declare locationId: number;

  @BelongsTo(() => Location, 'locationId')
  declare location: Location;
}
